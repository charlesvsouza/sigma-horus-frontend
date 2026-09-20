// Realinhamento de planilhas convertidas de PDF (o "XLSX desalinhado").
//
// Quando um relatório de impressão vira planilha por conversão de PDF, o texto
// de UMA linha do relatório se espalha por várias células e linhas da planilha
// (nome numa célula, valor noutra, a data colada na conta...). Não dá para ler
// por coluna. Estratégia usada aqui, para os dois relatórios que só existem
// nesse formato (Contas a Pagar/Receber e Clientes/Fornecedores):
//   1. reduzir cada célula a "fichas" tipadas (data, valor, nome, CPF, telefone…)
//      pelo que o texto CONTÉM, na ordem de leitura;
//   2. montar os registros pela ordem das fichas;
//   3. conferir cada registro contra uma redundância que o próprio relatório
//      traz (dias de atraso × vencimento; dígitos verificadores do CPF; total
//      declarado; "Qtde Itens") — o que não fechar vira aviso, nunca dado mudo.

import type { Grid } from './grid';
import { flattenCells } from './grid';
import { isValidCNPJ, isValidCPF } from '../masks';
import { addDaysIso, daysBetweenIso, isBrDate, isBrMoney, normalizeName, parseDateIso, parseMoney, round2 } from './values';

// ---------------------------------------------------------------------------
// Contas a Pagar e Receber por Vencimento
// ---------------------------------------------------------------------------

export interface OpenItem {
  name: string;
  dueDate: string; // ISO
  amount: number; // sempre positivo
  kind: 'receivable' | 'payable';
  daysOverdue: number | null; // "Vencido há N dia(s)" — só para conferência
}

export interface OpenItemsParsed {
  items: OpenItem[];
  referenceDate: string | null; // data em que o relatório foi emitido (deduzida de vencimento + dias de atraso)
  declared: { in: number | null; out: number | null };
  issues: string[];
}

export function looksLikeOpenItems(grids: Grid[]): boolean {
  const head = grids.flatMap((g) => g.rows.slice(0, 4).flat()).join(' ');
  return /Cliente\/Fornecedor/i.test(head) && /Vencimento/i.test(head) && /Valor/i.test(head) && /Conta/i.test(head);
}

const OPEN_HEADER_WORDS = /Cliente\/Fornecedor|Centro de Custos|Vencimento|\bConta\b|\bValor\b/g;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

interface Token {
  k: 'T' | 'D' | 'V' | 'N';
  v: string | number;
}

function tokenizeOpenItems(grids: Grid[]): Token[] {
  const tokens: Token[] = [];
  for (const grid of grids) {
    for (const cell of flattenCells(grid)) {
      if (PLAIN_NUMBER.test(cell) || isBrMoney(cell)) { tokens.push({ k: 'V', v: parseMoney(cell)! }); continue; }
      if (isBrDate(cell)) { tokens.push({ k: 'D', v: parseDateIso(cell)! }); continue; }
      let s = cell;
      const after: Token[] = [];
      for (const m of s.matchAll(/Vencido h[aá] (\d+) dia/gi)) after.push({ k: 'N', v: Number(m[1]) });
      s = s.replace(/Vencido h[aá] \d+ dia\(s\)/gi, ' ');
      for (const m of s.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)) after.push({ k: 'D', v: parseDateIso(m[1])! });
      s = s.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, ' ');
      s = s.replace(OPEN_HEADER_WORDS, ' ').replace(/\s+/g, ' ').trim();
      if (s) tokens.push({ k: 'T', v: s });
      // data antes do "Vencido há": é a ordem em que o relatório imprime.
      after.sort((a, b) => (a.k === b.k ? 0 : a.k === 'D' ? -1 : 1));
      tokens.push(...after);
    }
  }
  return tokens;
}

export function parseOpenItems(grids: Grid[]): OpenItemsParsed {
  const issues: string[] = [];
  const all = grids.map((g) => flattenCells(g).join(' ')).join(' ');
  const inM = all.match(/Total de Entradas:\s*(\(?[\d.]+,\d{2}\)?)/i);
  const outM = all.match(/Total de Sa[ií]das:\s*(\(?[\d.]+,\d{2}\)?)/i);
  const declared = { in: inM ? parseMoney(inM[1]) : null, out: outM ? parseMoney(outM[1]) : null };

  // Tudo depois de "Resumo Geral" é o rodapé de totais, não registro.
  const tokens = tokenizeOpenItems(grids);
  const stopAt = tokens.findIndex((t) => t.k === 'T' && /^Resumo/i.test(String(t.v)));
  const body = stopAt >= 0 ? tokens.slice(0, stopAt) : tokens;

  // Texto que se repete em muitos registros é conta bancária / centro de custos, não nome.
  const dateCount = body.filter((t) => t.k === 'D').length;
  const freq = new Map<string, number>();
  for (const t of body) if (t.k === 'T') freq.set(String(t.v), (freq.get(String(t.v)) ?? 0) + 1);
  const threshold = Math.max(3, Math.ceil(dateCount * 0.3));
  const noiseList = [...freq].filter(([, n]) => n >= threshold).map(([s]) => s).sort((a, b) => b.length - a.length);

  interface Rec { name: string; date?: string; value?: number; days: number[] }
  const recs: Rec[] = [];
  let cur: Rec | null = null;
  for (const t of body) {
    if (t.k === 'T') {
      // tira conta/centro de custos mesmo quando vêm colados ao nome ("Santander (Nenhum)").
      let s = String(t.v);
      for (const n of noiseList) s = s.split(n).join(' ');
      s = s.replace(/\(Nenhum\)/gi, ' ').replace(/\s+/g, ' ').trim();
      if (!s) continue;
      // Nome quebrado em duas células: ainda sem data/valor → continua o mesmo nome.
      if (cur && cur.date === undefined && cur.value === undefined) cur.name += ` ${s}`;
      else { cur = { name: s, days: [] }; recs.push(cur); }
    } else if (!cur) continue;
    else if (t.k === 'D') { if (cur.date === undefined) cur.date = String(t.v); }
    else if (t.k === 'V') { if (cur.value === undefined) cur.value = Number(t.v); }
    else cur.days.push(Number(t.v));
  }

  const complete = recs.filter((r) => r.date && r.value !== undefined);
  if (complete.length !== recs.length) issues.push(`${recs.length - complete.length} registro(s) sem data ou valor foram descartados.`);

  // Data de emissão = vencimento + dias de atraso (igual em todos os registros).
  const refVotes = new Map<string, number>();
  for (const r of complete) for (const d of r.days) {
    const ref = addDaysIso(r.date!, d);
    refVotes.set(ref, (refVotes.get(ref) ?? 0) + 1);
  }
  const referenceDate = [...refVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const items: OpenItem[] = complete.map((r) => {
    const days = referenceDate ? daysBetweenIso(r.date!, referenceDate) : null;
    if (referenceDate && r.days.length > 0 && !r.days.includes(days!)) {
      issues.push(`${r.name} (${r.date}): vencimento não bate com "vencido há ${r.days.join('/')} dia(s)".`);
    }
    return {
      name: r.name.replace(/\s+/g, ' ').trim(),
      dueDate: r.date!,
      amount: Math.abs(r.value!),
      kind: r.value! < 0 ? 'payable' : 'receivable',
      daysOverdue: r.days[0] ?? null,
    };
  });

  const sumIn = round2(items.filter((i) => i.kind === 'receivable').reduce((s, i) => s + i.amount, 0));
  const sumOut = round2(items.filter((i) => i.kind === 'payable').reduce((s, i) => s + i.amount, 0));
  if (declared.in != null && Math.abs(declared.in - sumIn) > 0.005) {
    issues.push(`Total de entradas declarado (${declared.in.toFixed(2)}) ≠ soma dos registros lidos (${sumIn.toFixed(2)}).`);
  }
  if (declared.out != null && Math.abs(Math.abs(declared.out) - sumOut) > 0.005) {
    issues.push(`Total de saídas declarado (${Math.abs(declared.out).toFixed(2)}) ≠ soma dos registros lidos (${sumOut.toFixed(2)}).`);
  }
  return { items, referenceDate, declared, issues };
}

// ---------------------------------------------------------------------------
// Cadastro de Clientes / Fornecedores
// ---------------------------------------------------------------------------

export interface CounterpartyRow {
  isCompany: boolean; // "J" (jurídica) × "F" (física)
  name: string;
  document: string | null; // só dígitos válidos, formatado
  invalidDocument: string | null; // documento lido mas com dígito verificador inválido (não vira `document`)
  phone: string | null;
  city: string | null;
  state: string | null;
  issues: string[];
}

export interface CounterpartiesParsed {
  rows: CounterpartyRow[];
  declaredCount: number | null; // "Qtde Itens: N"
  merged: string[]; // cadastros repetidos que foram unificados
  issues: string[];
}

export function looksLikeCounterparties(grids: Grid[]): boolean {
  const head = grids.flatMap((g) => g.rows.slice(0, 3).flat()).join(' ');
  return /Nome \/ Nome Fantasia/i.test(head) && /CPF\/CNPJ/i.test(head);
}

const CPF_RE = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
const CNPJ_RE = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
const PHONE_RE = /\(\d{2}\)\s?\d{4,5}-\d{4}/g;
const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const COUNTERPARTY_HEADER = /\bJ\/F\b|Nome \/ Nome Fantasia|\bRaz[aã]o Social\b|CPF\/CNPJ|\bEndere[cç]o\b|\bCategoria\b|\bCidade\b|\bFone 1\b|\bEstado\b|\bCelular\b|\bCEP\b/gi;

/** "FULANO DE TALFULANO DE TAL" / "FULANO DE TAL FULANO DE TAL" → "FULANO DE TAL". */
function dedupeRepeated(s: string): string {
  const x = s.trim();
  for (let i = Math.floor(x.length / 2) - 1; i <= Math.ceil(x.length / 2) + 1; i++) {
    const a = x.slice(0, i).trim();
    const b = x.slice(i).trim();
    if (a.length >= 4 && a === b) return a;
  }
  return x;
}

export function parseCounterparties(grids: Grid[]): CounterpartiesParsed {
  const issues: string[] = [];
  const all = grids.map((g) => flattenCells(g).join(' ')).join(' ');
  const declaredCount = Number(all.match(/Qtde Itens:\s*(\d+)/i)?.[1]) || null;

  interface Rec { company: boolean; names: string[]; docs: string[]; phones: string[]; city: string | null; state: string | null; hasName: boolean }
  const recs: Rec[] = [];
  let cur: Rec | null = null;

  for (const grid of grids) {
    for (const rawCell of flattenCells(grid)) {
      if (/^Qtde Itens/i.test(rawCell)) continue;
      const cell = rawCell.replace(COUNTERPARTY_HEADER, ' ').replace(/\s+/g, ' ').trim();
      if (!cell) continue;

      // Início de registro: "F"/"J" sozinho ou colado ao nome ("F ALZEMAR ...").
      let text = cell;
      const marker = text.match(/^([FJ])(?:\s+|$)/);
      if (marker) {
        cur = { company: marker[1] === 'J', names: [], docs: [], phones: [], city: null, state: null, hasName: false };
        recs.push(cur);
        text = text.slice(marker[0].length);
        if (!text) continue;
      }
      if (!cur) continue;

      const docs = [...(text.match(CNPJ_RE) ?? []), ...(text.match(CPF_RE) ?? [])];
      const phones = text.match(PHONE_RE) ?? [];
      const docPos = docs.length ? text.indexOf(docs[0]) : -1;
      const rest = text.replace(CNPJ_RE, ' ').replace(CPF_RE, ' ').replace(PHONE_RE, ' ');
      const pieces = rest.split(',').map((p) => p.trim()).filter(Boolean);

      // CPF impresso ANTES do nome numa linha nova é a 2ª linha do registro anterior.
      const hasLetters = pieces.some((p) => /[A-Za-zÀ-ÿ]{3,}/.test(p) && !isCityOrUf(p));
      let docTarget: Rec | null = cur;
      const fresh = !cur.hasName && cur.docs.length === 0 && cur.phones.length === 0;
      if (docs.length && fresh && docPos === 0 && hasLetters) {
        const prev = recs[recs.length - 2];
        if (prev && prev.docs.length === 0) docTarget = prev;
      }
      docTarget!.docs.push(...docs);
      cur.phones.push(...phones);

      for (const piece of pieces) {
        const words = piece.split(' ');
        const last = words[words.length - 1];
        if (UFS.has(piece)) {
          cur.state = piece;
          // a cidade vem logo antes da UF; sem razão social a 2ª "ficha de nome" é a cidade.
          if (!cur.city && cur.names.length >= 2) cur.city = cur.names.pop()!;
          continue;
        }
        if (words.length > 1 && UFS.has(last) && isCityOrUf(words.slice(0, -1).join(' '))) {
          cur.city = words.slice(0, -1).join(' '); cur.state = last; continue;
        }
        if (isCityOrUf(piece)) { cur.city = piece; continue; }
        if (!/[A-Za-zÀ-ÿ]{2,}/.test(piece)) continue;
        cur.names.push(dedupeRepeated(piece));
        cur.hasName = true;
      }
    }
  }

  const rows: CounterpartyRow[] = recs.map((r) => {
    const rowIssues: string[] = [];
    // Nome fantasia truncado + razão social completa: fica a mais longa que começa igual.
    const names = r.names.filter(Boolean);
    let name = names[0] ?? '';
    for (const n of names.slice(1)) if (normalizeName(n).startsWith(normalizeName(name)) && n.length > name.length) name = n;
    const doc = r.docs[0] ?? null;
    let document: string | null = null;
    let invalidDocument: string | null = null;
    if (doc) {
      const ok = doc.length === 14 ? isValidCPF(doc) : isValidCNPJ(doc);
      if (ok) document = doc;
      else { invalidDocument = doc; rowIssues.push(`documento ${doc} com dígito verificador inválido — guardado só na observação`); }
    }
    if (!name) rowIssues.push('registro sem nome');
    return {
      isCompany: r.company, name, document, invalidDocument, phone: r.phones[0] ?? null, city: r.city, state: r.state, issues: rowIssues,
    };
  }).filter((r) => r.name);

  if (declaredCount != null && rows.length !== declaredCount) {
    issues.push(`O relatório declara ${declaredCount} cadastro(s), mas foram lidos ${rows.length}.`);
  }
  const merged = mergeDuplicateRows(rows);
  const seen = new Map<string, string>();
  for (const r of merged.rows) {
    if (!r.document) continue;
    const other = seen.get(r.document);
    if (other && normalizeName(other) !== normalizeName(r.name)) issues.push(`Documento ${r.document} aparece em "${other}" e em "${r.name}".`);
    seen.set(r.document, r.name);
  }
  return { rows: merged.rows, declaredCount, merged: merged.notes, issues };
}

const hasData = (r: CounterpartyRow) => !!(r.document || r.invalidDocument || r.phone);

/**
 * O sistema antigo tem cadastros repetidos (mesmo nome duas vezes, ou o nome
 * cortado numa linha e completo na outra). Junta os que são só repetição:
 * nome igual, ou um cadastro "vazio" cujo nome continua o do outro.
 */
function mergeDuplicateRows(rows: CounterpartyRow[]): { rows: CounterpartyRow[]; notes: string[] } {
  const out: CounterpartyRow[] = [];
  const notes: string[] = [];
  for (const row of rows) {
    const key = normalizeName(row.name);
    const twin = out.find((o) => {
      const k = normalizeName(o.name);
      if (k === key) return true;
      const [short, long] = k.length <= key.length ? [k, key] : [key, k];
      const bare = k.length <= key.length ? !hasData(o) : !hasData(row);
      return short.length >= 12 && long.startsWith(short) && (bare || !hasData(o) || !hasData(row));
    });
    if (!twin) { out.push({ ...row }); continue; }
    if (row.name.length > twin.name.length) twin.name = row.name;
    twin.document ??= row.document;
    twin.invalidDocument ??= row.invalidDocument;
    twin.phone ??= row.phone;
    twin.city ??= row.city;
    twin.state ??= row.state;
    notes.push(`"${row.name}" repetido no cadastro antigo — unificado.`);
  }
  return { rows: out, notes };
}

function isCityOrUf(p: string): boolean {
  return UFS.has(p) || /^(Rio de Janeiro|Niter[oó]i|S[aã]o Paulo|Belo Horizonte|Duque de Caxias|Nova Igua[cç]u|S[aã]o Gon[cç]alo|Maric[aá]|Petr[oó]polis)$/i.test(p);
}
