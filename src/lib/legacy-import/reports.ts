// Parsers dos relatórios de "impressão" de sistemas legados (Cenize/Loje):
// Extrato de Conta, Razão por plano de conta e Balancete por plano de conta.
// Cada um recebe a grade de texto (grid.ts) e devolve dados estruturados MAIS
// os totais que o próprio relatório declara — quem chama confere a soma contra
// esses totais antes de gravar qualquer coisa (planner.ts).
//
// Regra comum: as colunas mudam de posição entre páginas do mesmo relatório,
// então nunca se usa índice fixo — cada linha é lida pelo que ela CONTÉM
// (data, dinheiro, texto) e pela posição relativa à data.

import type { Grid } from './grid';
import { isBrDate, isBrMoney, parseDateIso, parseMoney, round2 } from './values';

const t = (s: string | undefined) => (s ?? '').trim();
const indentOf = (s: string | undefined) => (s ?? '').length - (s ?? '').trimStart().length;

// ---------------------------------------------------------------------------
// Extrato de Conta
// ---------------------------------------------------------------------------

export interface ExtratoEntry {
  account: string; // Caixa | Santander | ...
  date: string; // ISO
  favorecido: string;
  planoConta: string; // "Financeiro:Mensalidade", "(Dividido)", "" quando o legado não classificou
  numero: string;
  valor: number; // assinado: crédito +, débito −
  saldo: number | null; // saldo corrente da conta depois do lançamento
}

export interface ExtratoAccountInfo {
  name: string;
  openingBalance: number;
  openingDate: string | null;
  declaredIn: number | null;
  declaredOut: number | null;
  declaredCount: number | null;
}

export interface ExtratoParsed {
  entries: ExtratoEntry[];
  accounts: ExtratoAccountInfo[];
  periodFrom: string | null;
  periodTo: string | null;
  declaredTotals: { in: number | null; out: number | null; count: number | null; finalBalance: number | null };
}

export function looksLikeExtrato(grid: Grid): boolean {
  const head = grid.rows.slice(0, 60);
  return head.some((r) => r.some((c) => t(c) === 'Favorecido/Pagador')) && head.some((r) => r.some((c) => t(c) === 'Plano de Conta'));
}

export function parsePeriod(grid: Grid): { from: string | null; to: string | null } {
  for (const row of grid.rows.slice(0, 15)) {
    for (const c of row) {
      const m = t(c).match(/Per[ií]odo:\s*de\s*(\d{2}\/\d{2}\/\d{4})\s*at[eé]\s*(\d{2}\/\d{2}\/\d{4})/i);
      if (m) return { from: parseDateIso(m[1]), to: parseDateIso(m[2]) };
    }
  }
  return { from: null, to: null };
}

function moneyAfter(cells: string[], from: number): number | null {
  for (let i = from + 1; i < cells.length; i++) if (isBrMoney(cells[i])) return parseMoney(cells[i]);
  return null;
}

export function parseExtrato(grid: Grid): ExtratoParsed {
  const entries: ExtratoEntry[] = [];
  const accounts = new Map<string, ExtratoAccountInfo>();
  const declared: ExtratoParsed['declaredTotals'] = { in: null, out: null, count: null, finalBalance: null };
  const period = parsePeriod(grid);

  let col: { date: number; numero: number; favorecido: number; planoConta: number; valor: number; saldo: number } | null = null;
  let current: string | null = null;
  let summaryOf: string | null | 'geral' = null;

  const account = (name: string) => {
    let a = accounts.get(name);
    if (!a) {
      a = { name, openingBalance: 0, openingDate: null, declaredIn: null, declaredOut: null, declaredCount: null };
      accounts.set(name, a);
    }
    return a;
  };

  for (const raw of grid.rows) {
    const cells = raw.map(t);
    if (!cells.some(Boolean)) continue;

    if (cells.includes('Data') && (cells.includes('Valor') || cells.includes('Saldo'))) {
      col = {
        date: cells.indexOf('Data'),
        numero: cells.indexOf('Número'),
        favorecido: cells.indexOf('Favorecido/Pagador'),
        planoConta: cells.indexOf('Plano de Conta'),
        valor: cells.indexOf('Valor'),
        saldo: cells.indexOf('Saldo'),
      };
      continue;
    }

    const contaIdx = cells.indexOf('Conta:');
    if (contaIdx >= 0) {
      const nameIdx = cells.findIndex((c, i) => i > contaIdx && c);
      current = nameIdx >= 0 ? cells[nameIdx] : null;
      if (current) account(current);
      continue;
    }

    const opening = cells.findIndex((c) => /^Saldo em \d{2}\/\d{2}\/\d{4}$/.test(c));
    if (opening >= 0 && current) {
      const a = account(current);
      a.openingDate = parseDateIso(cells[opening].slice(-10));
      a.openingBalance = moneyAfter(cells, opening) ?? 0;
      continue;
    }

    // Resumos: por conta ("Resumo" + nome da conta) e geral.
    const resumo = cells.indexOf('Resumo');
    if (resumo >= 0) {
      const nameIdx = cells.findIndex((c, i) => i > resumo && c && !/^Total/.test(c));
      summaryOf = nameIdx >= 0 ? cells[nameIdx] : null;
    }
    if (cells.includes('Resumo Geral')) summaryOf = 'geral';
    const inIdx = cells.indexOf('Total de Entradas:');
    const outIdx = cells.indexOf('Total de Saídas:');
    const finalIdx = cells.indexOf('Saldo Final:');
    const countCell = cells.find((c) => /^Total lan[cç]amentos:\s*\d+/.test(c));
    if (inIdx >= 0 || outIdx >= 0 || finalIdx >= 0 || countCell || resumo >= 0) {
      const inV = inIdx >= 0 ? moneyAfter(cells, inIdx) : null;
      const outV = outIdx >= 0 ? moneyAfter(cells, outIdx) : null;
      const finV = finalIdx >= 0 ? moneyAfter(cells, finalIdx) : null;
      const cnt = countCell ? Number(countCell.match(/(\d+)/)![1]) : null;
      if (summaryOf === 'geral') {
        if (inV != null) declared.in = inV;
        if (outV != null) declared.out = outV;
        if (finV != null) declared.finalBalance = finV;
        if (cnt != null) declared.count = cnt;
      } else if (summaryOf) {
        const a = account(summaryOf);
        if (inV != null) a.declaredIn = inV;
        if (outV != null) a.declaredOut = outV;
        if (cnt != null) a.declaredCount = cnt;
      }
      continue;
    }
    // "Saldo Final" de uma linha só com o valor solto (layout quebrado): ignora.

    if (!col || !current) continue;
    const date = parseDateIso(cells[col.date]);
    if (!date) continue; // linha de continuação (histórico livre / centro de custo)

    const valor = parseMoney(cells[col.valor]);
    if (valor == null) continue;
    let cd = '';
    for (let i = col.saldo + 1; i < cells.length; i++) if (cells[i] === 'C' || cells[i] === 'D') { cd = cells[i]; break; }

    entries.push({
      account: current,
      date,
      favorecido: cells[col.favorecido] ?? '',
      planoConta: cells[col.planoConta] ?? '',
      numero: cells[col.numero] ?? '',
      valor: cd === 'D' ? -Math.abs(valor) : Math.abs(valor),
      saldo: col.saldo >= 0 ? parseMoney(cells[col.saldo]) : null,
    });
  }

  return { entries, accounts: [...accounts.values()], periodFrom: period.from, periodTo: period.to, declaredTotals: declared };
}

// ---------------------------------------------------------------------------
// Razão e Balancete por plano de conta (hierarquia por recuo)
// ---------------------------------------------------------------------------

export interface LedgerEntry {
  path: string[]; // ["Receitas", "Financeiro", "Mensalidade"]; [] = "(Não definido)"
  date: string; // ISO
  history: string;
  costCenter: string;
  debit: number; // ≤ 0
  credit: number; // ≥ 0
  valor: number; // debit + credit
}

export function looksLikeLedger(grid: Grid, kind: 'razao' | 'balancete'): boolean {
  const head = grid.rows.slice(0, 8).flat().map(t).join(' ');
  if (!/Lan[cç]amentos por Plano de Conta/i.test(head)) return false;
  return kind === 'razao' ? /Raz[aã]o/i.test(head) : /Balancete/i.test(head);
}

const NOT_DEFINED = '(Não definido)';

interface LedgerRow {
  indent: number;
  name: string;
  money: number[]; // dinheiro na ordem em que aparece
}

/** Lê Razão ou Balancete: devolve as linhas de grupo (com totais) e os lançamentos. */
function parseLedger(grid: Grid) {
  const groups: LedgerRow[] = [];
  const entries: (LedgerEntry & { groupIndex: number })[] = [];
  const stack: { indent: number; name: string }[] = [];
  let last: (LedgerEntry & { groupIndex: number }) | null = null;
  let lastDateIdx = -1;
  const declared = { opening: null as number | null, debit: null as number | null, credit: null as number | null, closing: null as number | null };

  for (const raw of grid.rows) {
    const cells = raw.map((c) => c ?? '');
    const trimmed = cells.map(t);
    if (!trimmed.some(Boolean)) continue;

    // Cabeçalho de grupo: o nome fica na coluna 1, com recuo.
    const first = cells[1] ?? '';
    const isTitle = /Lan[cç]amentos por Plano|^Per[ií]odo|^Exerc[ií]cio|Emitido em|Plano de Conta$/.test(t(first));
    if (t(first) && !isTitle) {
      if (t(first) === 'Resumo Geral') {
        const money = trimmed.filter(isBrMoney).map((c) => parseMoney(c)!);
        if (money.length >= 4) [declared.opening, declared.debit, declared.credit, declared.closing] = [money[0], money[1], money[2], money[money.length - 1]];
        else if (money.length === 3) [declared.opening, declared.credit, declared.closing] = money;
        continue;
      }
      const indent = indentOf(first);
      const name = t(first);
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      stack.push({ indent, name });
      groups.push({ indent, name, money: trimmed.filter(isBrMoney).map((c) => parseMoney(c)!) });
      last = null;
      continue;
    }

    // Lançamento: 1ª célula preenchida (a partir da coluna 2) é uma data e a linha tem dinheiro.
    const dateIdx = trimmed.findIndex((c, i) => i >= 2 && c !== '');
    if (dateIdx >= 0 && isBrDate(trimmed[dateIdx])) {
      const moneyIdx = trimmed.map((c, i) => (i > dateIdx && isBrMoney(c) ? i : -1)).filter((i) => i >= 0);
      if (moneyIdx.length === 0) continue; // segunda data da linha (competência etc.)
      const texts = trimmed.map((c, i) => ({ c, i })).filter(({ c, i }) => i > dateIdx && i < moneyIdx[0] && c !== '');
      let history = '';
      let costCenter = '';
      if (texts.length >= 2) [history, costCenter] = [texts[0].c, texts[1].c];
      else if (texts.length === 1) {
        if (texts[0].i - dateIdx === 1 || !/^LOJA |^\(Nenhum\)/i.test(texts[0].c)) history = texts[0].c;
        else costCenter = texts[0].c;
      }
      const amounts = moneyIdx.map((i) => parseMoney(trimmed[i])!);
      let debit = 0;
      let credit = 0;
      if (amounts.length >= 2) [debit, credit] = [Math.min(0, amounts[0]), Math.max(0, amounts[1])];
      else if (amounts[0] < 0) debit = amounts[0];
      else credit = amounts[0];
      const path = stack.map((s) => s.name).filter((n) => n !== NOT_DEFINED);
      const entry = {
        path, date: parseDateIso(trimmed[dateIdx])!, history, costCenter, debit: round2(debit), credit: round2(credit), valor: round2(debit + credit),
        groupIndex: groups.length - 1,
      };
      entries.push(entry);
      last = entry;
      lastDateIdx = dateIdx;
      continue;
    }

    // Continuação do histórico (quebra de linha do relatório): 1 célula só, na coluna do histórico.
    if (last && lastDateIdx >= 0) {
      const filled = trimmed.map((c, i) => ({ c, i })).filter(({ c }) => c !== '');
      if (filled.length === 1 && filled[0].i === lastDateIdx + 1 && !isBrDate(filled[0].c) && !isBrMoney(filled[0].c) && !/^(P[aá]gina|Cenize|http)/i.test(filled[0].c)) {
        last.history = `${last.history} ${filled[0].c}`.trim();
      }
    }
  }
  return { groups, entries, declared };
}

function toLedgerEntry(e: LedgerEntry & { groupIndex: number }): LedgerEntry {
  return { path: e.path, date: e.date, history: e.history, costCenter: e.costCenter, debit: e.debit, credit: e.credit, valor: e.valor };
}

function toBalanceteLine(l: BalanceteLine & { groupIdx: number }): BalanceteLine {
  return { path: l.path, level: l.level, opening: l.opening, debit: l.debit, credit: l.credit, closing: l.closing, entries: l.entries };
}

export interface RazaoParsed {
  entries: LedgerEntry[];
  periodFrom: string | null;
  periodTo: string | null;
  total: number; // soma dos lançamentos
}

export function parseRazao(grid: Grid): RazaoParsed {
  const { entries } = parseLedger(grid);
  const period = parsePeriod(grid);
  return {
    entries: entries.map(toLedgerEntry),
    periodFrom: period.from,
    periodTo: period.to,
    total: round2(entries.reduce((s, e) => s + e.valor, 0)),
  };
}

export interface BalanceteLine {
  path: string[];
  level: number; // 0 = raiz (Receitas/Despesas/(Não definido))
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  entries: number;
}

export interface BalanceteParsed {
  lines: BalanceteLine[];
  periodFrom: string | null;
  periodTo: string | null;
  exercise: number | null;
  lodgeName: string | null;
  declared: { opening: number | null; debit: number | null; credit: number | null; closing: number | null };
  entries: LedgerEntry[];
  issues: string[];
}

export function parseBalancete(grid: Grid): BalanceteParsed {
  const { groups, entries, declared } = parseLedger(grid);
  const period = parsePeriod(grid);
  const head = grid.rows.slice(0, 8).flat().map(t);
  const exercise = head.map((c) => c.match(/^Exerc[ií]cio:\s*(\d{4})/)?.[1]).find(Boolean);
  const lodgeName = head.filter((c) => /LOJA|LODGE/i.test(c) && !/Lan[cç]amentos/i.test(c)).join(' ').replace(/\s+/g, ' ').trim() || null;

  // Caminho de cada grupo pela pilha de recuos.
  const stack: { indent: number; name: string }[] = [];
  const lines: (BalanceteLine & { groupIdx: number })[] = groups.map((g, groupIdx) => {
    while (stack.length && stack[stack.length - 1].indent >= g.indent) stack.pop();
    stack.push({ indent: g.indent, name: g.name });
    const closing = g.money.length ? g.money[g.money.length - 1] : 0;
    const opening = g.money.length ? g.money[0] : 0;
    return { path: stack.map((s) => s.name), level: stack.length - 1, opening, debit: 0, credit: 0, closing, entries: 0, groupIdx };
  });

  // Débito/crédito de cada folha vêm dos lançamentos abaixo dela; o pai soma os filhos.
  for (const e of entries) {
    const ln = lines[e.groupIndex];
    if (!ln) continue;
    ln.debit = round2(ln.debit + e.debit);
    ln.credit = round2(ln.credit + e.credit);
    ln.entries += 1;
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i];
    for (let j = i + 1; j < lines.length && lines[j].level > ln.level; j++) {
      if (lines[j].level === ln.level + 1) {
        ln.debit = round2(ln.debit + lines[j].debit);
        ln.credit = round2(ln.credit + lines[j].credit);
        ln.entries += lines[j].entries;
      }
    }
  }

  const issues: string[] = [];
  for (const ln of lines) {
    const expected = round2(ln.opening + ln.debit + ln.credit);
    if (Math.abs(expected - ln.closing) > 0.01 && ln.path[0] !== NOT_DEFINED) {
      // Pais podem divergir por arredondamento/layout; só as folhas com lançamentos importam.
      if (ln.entries > 0 && !lines.some((o) => o.groupIdx > ln.groupIdx && o.level > ln.level)) {
        issues.push(`${ln.path.join(' › ')}: saldo atual ${ln.closing.toFixed(2)} ≠ abertura + débitos + créditos (${expected.toFixed(2)}).`);
      }
    }
  }

  return {
    lines: lines.map(toBalanceteLine),
    periodFrom: period.from,
    periodTo: period.to,
    exercise: exercise ? Number(exercise) : null,
    lodgeName,
    declared,
    entries: entries.map(toLedgerEntry),
    issues,
  };
}
