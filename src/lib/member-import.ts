import { parseBrDate, splitCsvLine } from './bank-statement';
import { isValidCPF } from './masks';
import type { MemberFields } from './member-fields';
import { parsePhilosophicalDegree } from './masonic-degree';

// Motor de importação de cadastro de membros (wizard de migração/sincronização,
// ver dashboard/configuracoes/importar). Lê CSV/XLSX de outro sistema, tenta
// mapear as colunas do arquivo aos campos do Member por nome (com aliases
// PT/EN) e calcula um percentual de compatibilidade ponderado por
// importância do campo. Não decide sozinho — o admin revisa/ajusta o
// mapeamento e, quando já há membros na loja, também revisa a classificação
// novo/já existe/ambíguo (classifyRows) antes de confirmar (ImportarClient.tsx).

type ImportableField = Exclude<keyof MemberFields, 'name' | 'riteId' | 'powerId' | 'originPowerId'>;

interface TargetFieldDef {
  field: ImportableField;
  label: string;
  tier: 1 | 2 | 3; // 1 = essencial, 2 = maçônico, 3 = pessoal/endereço — pesa a % de compatibilidade
  kind: 'text' | 'date' | 'boolean';
  aliases: string[];
}

export const TARGET_FIELDS: TargetFieldDef[] = [
  { field: 'email', label: 'E-mail', tier: 1, kind: 'text', aliases: ['email', 'e-mail', 'correio eletronico'] },
  { field: 'phone', label: 'Telefone', tier: 1, kind: 'text', aliases: ['telefone', 'celular', 'phone', 'contato', 'whatsapp'] },
  { field: 'cpf', label: 'CPF', tier: 1, kind: 'text', aliases: ['cpf', 'documento'] },
  { field: 'birthDate', label: 'Data de nascimento', tier: 1, kind: 'date', aliases: ['data de nascimento', 'nascimento', 'birthdate', 'dt nascimento', 'data nasc'] },
  { field: 'status', label: 'Situação', tier: 1, kind: 'text', aliases: ['status', 'situacao', 'situação'] },
  { field: 'currentDegree', label: 'Grau filosófico atual', tier: 2, kind: 'text', aliases: ['grau', 'grau atual', 'grau filosofico', 'grau filosófico'] },
  { field: 'initiationDate', label: 'Data de iniciação', tier: 2, kind: 'date', aliases: ['iniciacao', 'iniciação', 'data de iniciacao', 'data de iniciação'] },
  { field: 'elevationDate', label: 'Data de elevação', tier: 2, kind: 'date', aliases: ['elevacao', 'elevação', 'data de elevacao', 'data de elevação'] },
  { field: 'exaltationDate', label: 'Data de exaltação', tier: 2, kind: 'date', aliases: ['exaltacao', 'exaltação', 'data de exaltacao', 'data de exaltação'] },
  { field: 'installationDate', label: 'Data de instalação', tier: 2, kind: 'date', aliases: ['instalacao', 'instalação', 'data de instalacao', 'data de instalação'] },
  { field: 'initiationLodge', label: 'Loja de iniciação', tier: 2, kind: 'text', aliases: ['loja de iniciacao', 'loja de iniciação'] },
  { field: 'elevationLodge', label: 'Loja de elevação', tier: 2, kind: 'text', aliases: ['loja de elevacao', 'loja de elevação'] },
  { field: 'exaltationLodge', label: 'Loja de exaltação', tier: 2, kind: 'text', aliases: ['loja de exaltacao', 'loja de exaltação'] },
  { field: 'installationLodge', label: 'Loja de instalação', tier: 2, kind: 'text', aliases: ['loja de instalacao', 'loja de instalação'] },
  { field: 'masonicNumber', label: 'Número maçônico / CIM', tier: 2, kind: 'text', aliases: ['numero maconico', 'número maçônico', 'cim', 'matricula', 'matrícula'] },
  { field: 'originLodge', label: 'Loja de origem', tier: 2, kind: 'text', aliases: ['loja de origem', 'origem'] },
  { field: 'rg', label: 'RG', tier: 3, kind: 'text', aliases: ['rg', 'identidade'] },
  { field: 'maritalStatus', label: 'Estado civil', tier: 3, kind: 'text', aliases: ['estado civil'] },
  { field: 'spouseName', label: 'Nome do cônjuge', tier: 3, kind: 'text', aliases: ['esposa', 'conjuge', 'cônjuge', 'nome do conjuge', 'nome do cônjuge'] },
  { field: 'spouseBirthDate', label: 'Nascimento do cônjuge', tier: 3, kind: 'date', aliases: ['nascimento do conjuge', 'nascimento do cônjuge', 'nascimento da esposa'] },
  { field: 'childrenNames', label: 'Filhos', tier: 3, kind: 'text', aliases: ['filhos', 'dependentes'] },
  { field: 'fatherName', label: 'Nome do pai', tier: 3, kind: 'text', aliases: ['pai', 'nome do pai'] },
  { field: 'motherName', label: 'Nome da mãe', tier: 3, kind: 'text', aliases: ['mae', 'mãe', 'nome da mae', 'nome da mãe'] },
  { field: 'occupation', label: 'Profissão', tier: 3, kind: 'text', aliases: ['profissao', 'profissão', 'ocupacao', 'ocupação'] },
  { field: 'nationality', label: 'Nacionalidade', tier: 3, kind: 'text', aliases: ['nacionalidade'] },
  { field: 'addressLine', label: 'Endereço', tier: 3, kind: 'text', aliases: ['endereco', 'endereço', 'logradouro', 'rua'] },
  { field: 'addressNumber', label: 'Número', tier: 3, kind: 'text', aliases: ['numero', 'número', 'nº'] },
  { field: 'complement', label: 'Complemento', tier: 3, kind: 'text', aliases: ['complemento'] },
  { field: 'neighborhood', label: 'Bairro', tier: 3, kind: 'text', aliases: ['bairro'] },
  { field: 'city', label: 'Cidade', tier: 3, kind: 'text', aliases: ['cidade', 'municipio', 'município'] },
  { field: 'state', label: 'Estado (UF)', tier: 3, kind: 'text', aliases: ['estado', 'uf'] },
  { field: 'zipCode', label: 'CEP', tier: 3, kind: 'text', aliases: ['cep'] },
  { field: 'country', label: 'País', tier: 3, kind: 'text', aliases: ['pais', 'país'] },
  { field: 'duesExempt', label: 'Isento de mensalidade', tier: 3, kind: 'boolean', aliases: ['isento', 'isento de mensalidade'] },
  { field: 'documents', label: 'Documentos (observação)', tier: 3, kind: 'text', aliases: ['documentos'] },
  { field: 'notes', label: 'Observações', tier: 3, kind: 'text', aliases: ['observacoes', 'observações', 'notas'] },
];

const NAME_ALIASES = ['nome', 'nome completo', 'name', 'full name', 'nome do membro', 'nome do obreiro'];
const RITE_ALIASES = ['rito'];
const POWER_ALIASES = ['potencia', 'potência'];

const TIER_WEIGHT: Record<number, number> = { 1: 3, 2: 2, 3: 1 };

export interface FieldMapping {
  nameIndex: number | null;
  riteIndex: number | null;
  powerIndex: number | null;
  fields: Partial<Record<ImportableField, number>>;
}

export interface RowIssue {
  row: number; // 1-based, contando a 1ª linha de dados como 1 (cabeçalho não conta)
  field?: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface AppliedRow {
  row: number;
  body: Record<string, unknown>; // já no formato que parseMemberFields espera
  riteName: string | null;
  powerName: string | null;
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    // remove marcas combinantes (acentos): faixa U+0300-U+036F
    .split('')
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp < 0x300 || cp > 0x36f;
    })
    .join('')
    .trim();
}

// `claimed` evita que a mesma coluna do arquivo seja atribuída a dois campos
// do SigmaHorus ao mesmo tempo (ex.: "Estado" batendo tanto com "Estado (UF)"
// quanto, por substring, com "Estado civil" — cada coluna serve só um campo).
function findColumn(headers: string[], aliases: string[], claimed?: ReadonlySet<number>): number | null {
  const normHeaders = headers.map(norm);
  const normAliases = aliases.map(norm);
  const isFree = (i: number) => !claimed?.has(i);
  const exact = normHeaders.findIndex((h, i) => isFree(i) && normAliases.includes(h));
  if (exact !== -1) return exact;
  const partial = normHeaders.findIndex((h, i) => isFree(i) && h.length > 0 && normAliases.some((a) => h.includes(a)));
  return partial !== -1 ? partial : null;
}

/** Tenta casar um nome de rito/potência do arquivo com um registro já existente na loja. */
export function resolveByName(raw: string | null, options: { id: string; name: string }[]): { id: string | null; matched: boolean } {
  if (!raw) return { id: null, matched: true };
  const n = norm(raw);
  const found = options.find((o) => norm(o.name) === n);
  return { id: found?.id ?? null, matched: !!found };
}

/** Auto-detecção inicial do mapeamento a partir dos cabeçalhos do arquivo. */
export function detectMapping(headers: string[]): FieldMapping {
  const claimed = new Set<number>();

  const nameIndex = findColumn(headers, NAME_ALIASES, claimed);
  if (nameIndex != null) claimed.add(nameIndex);
  const riteIndex = findColumn(headers, RITE_ALIASES, claimed);
  if (riteIndex != null) claimed.add(riteIndex);
  const powerIndex = findColumn(headers, POWER_ALIASES, claimed);
  if (powerIndex != null) claimed.add(powerIndex);

  const fields: Partial<Record<ImportableField, number>> = {};
  for (const tf of TARGET_FIELDS) {
    const idx = findColumn(headers, tf.aliases, claimed);
    if (idx != null) {
      fields[tf.field] = idx;
      claimed.add(idx);
    }
  }
  return { nameIndex, riteIndex, powerIndex, fields };
}

/** % de compatibilidade ponderado por tier — usado tanto no auto-detect quanto após ajuste manual. */
export function scoreMapping(fields: Partial<Record<ImportableField, number>>) {
  let matchedWeight = 0;
  let totalWeight = 0;
  let matchedCount = 0;
  for (const tf of TARGET_FIELDS) {
    totalWeight += TIER_WEIGHT[tf.tier];
    if (fields[tf.field] != null) {
      matchedWeight += TIER_WEIGHT[tf.tier];
      matchedCount++;
    }
  }
  return {
    score: totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0,
    matchedCount,
    totalCount: TARGET_FIELDS.length,
  };
}

/**
 * Aplica o mapeamento às linhas do arquivo, produzindo o body pronto para
 * parseMemberFields (datas já normalizadas p/ ISO) + a lista de problemas.
 * Linhas sem nome viram erro (não entram no resultado); demais problemas
 * (CPF inválido, data não reconhecida, CPF duplicado no arquivo) são avisos —
 * a linha é importada mesmo assim, para não perder dado por uma inconsistência.
 */
export function applyMapping(headers: string[], rows: string[][], mapping: FieldMapping) {
  const rowIssues: RowIssue[] = [];
  const out: AppliedRow[] = [];
  const seenCpf = new Map<string, number>();

  rows.forEach((cells, i) => {
    const rowNum = i + 1;
    if (cells.every((c) => !c || !c.trim())) return; // linha em branco — ignora silenciosamente

    const name = mapping.nameIndex != null ? (cells[mapping.nameIndex] ?? '').trim() : '';
    if (!name) {
      rowIssues.push({ row: rowNum, field: 'name', severity: 'error', message: 'Linha sem nome — não será importada.' });
      return;
    }

    const body: Record<string, unknown> = { name };

    for (const tf of TARGET_FIELDS) {
      const idx = mapping.fields[tf.field];
      if (idx == null) continue;
      const raw = (cells[idx] ?? '').trim();
      if (!raw) continue;

      if (tf.kind === 'date') {
        const d = parseBrDate(raw);
        if (!d) {
          rowIssues.push({ row: rowNum, field: tf.field, severity: 'warning', message: `"${raw}" não parece uma data válida para ${tf.label} — campo deixado em branco.` });
          continue;
        }
        body[tf.field] = d.toISOString();
      } else if (tf.kind === 'boolean') {
        body[tf.field] = /^(sim|yes|true|1|x)$/i.test(raw) ? 'true' : 'false';
      } else if (tf.field === 'currentDegree') {
        // Grau filosófico REAA: só 4–33 (mesmo range do <select> do form manual).
        // Diferente do CPF, deixa em branco em vez de importar mesmo assim — um
        // grau fora do range fica invisível depois (degreeShort não tinha como
        // sinalizar), então é melhor barrar aqui do que confiar na exibição.
        if (!parsePhilosophicalDegree(raw)) {
          rowIssues.push({ row: rowNum, field: tf.field, severity: 'warning', message: `"${raw}" não é um grau filosófico válido (4–33) para ${tf.label} — campo deixado em branco.` });
          continue;
        }
        body[tf.field] = raw;
      } else {
        body[tf.field] = raw;
        if (tf.field === 'cpf') {
          if (!isValidCPF(raw)) {
            rowIssues.push({ row: rowNum, field: 'cpf', severity: 'warning', message: `CPF "${raw}" não é válido — importado mesmo assim; revise manualmente.` });
          } else {
            const key = raw.replace(/\D/g, '');
            if (seenCpf.has(key)) {
              rowIssues.push({ row: rowNum, field: 'cpf', severity: 'warning', message: `CPF duplicado neste arquivo — já usado na linha ${seenCpf.get(key)}.` });
            } else {
              seenCpf.set(key, rowNum);
            }
          }
        }
      }
    }

    out.push({
      row: rowNum,
      body,
      riteName: mapping.riteIndex != null ? (cells[mapping.riteIndex] ?? '').trim() || null : null,
      powerName: mapping.powerIndex != null ? (cells[mapping.powerIndex] ?? '').trim() || null : null,
    });
  });

  return { rows: out, rowIssues, totalRows: rows.length, importableRows: out.length };
}

export type MatchStatus = 'new' | 'duplicate' | 'ambiguous';

export interface ExistingMemberRef {
  id: string;
  cpf: string | null;
}

export interface ClassifiedRow extends AppliedRow {
  matchStatus: MatchStatus;
  matchedMemberId: string | null;
}

/**
 * Classifica cada linha contra os membros já cadastrados na loja, para permitir
 * reimportar/sincronizar sem duplicar (ver dashboard/configuracoes/importar).
 * CPF é a única chave confiável presente nos dois lados — sem CPF válido na
 * linha (ou quando ele não bate com nenhum CPF já cadastrado, mas também não
 * há como confirmar identidade) não dá pra decidir sozinho: a linha fica
 * "ambiguous" e exige decisão manual do admin na tela de revisão. Nunca
 * atualiza um membro existente — no máximo cria um novo ou pula.
 */
export function classifyRows(rows: AppliedRow[], existingMembers: ExistingMemberRef[]): ClassifiedRow[] {
  const existingByCpf = new Map<string, string>();
  for (const m of existingMembers) {
    const key = (m.cpf ?? '').replace(/\D/g, '');
    if (key) existingByCpf.set(key, m.id);
  }

  return rows.map((r) => {
    const cpfRaw = typeof r.body.cpf === 'string' ? r.body.cpf : '';
    const key = cpfRaw.replace(/\D/g, '');
    if (!key) return { ...r, matchStatus: 'ambiguous', matchedMemberId: null };
    const matchedId = existingByCpf.get(key) ?? null;
    return matchedId
      ? { ...r, matchStatus: 'duplicate', matchedMemberId: matchedId }
      : { ...r, matchStatus: 'new', matchedMemberId: null };
  });
}

/** Lê CSV (texto) ou XLSX (binário) e devolve uma grade genérica cabeçalho+linhas. */
export async function parseSpreadsheet(file: { name: string; type: string; buffer: Buffer }): Promise<{ headers: string[]; rows: string[][] }> {
  const isXlsx = /\.xlsx$/i.test(file.name) || file.type.includes('spreadsheet') || file.type.includes('officedocument');

  if (isXlsx) {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    // Buffer do exceljs não usa o parâmetro genérico do @types/node atual — mesmo valor em runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { headers: [], rows: [] };

    const grid: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const v = cell.value;
        if (v instanceof Date) cells.push(v.toLocaleDateString('pt-BR'));
        else if (v && typeof v === 'object' && 'text' in v) cells.push(String((v as { text?: unknown }).text ?? ''));
        else if (v && typeof v === 'object' && 'result' in v) cells.push(String((v as { result?: unknown }).result ?? ''));
        else cells.push(v == null ? '' : String(v));
      });
      grid.push(cells);
    });

    const [headerRow, ...dataRows] = grid;
    return { headers: (headerRow ?? []).map((h) => h.trim()), rows: dataRows };
  }

  let text = file.buffer.toString('utf-8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  return { headers: splitCsvLine(lines[0]), rows: lines.slice(1).map(splitCsvLine) };
}
