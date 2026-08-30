// Parser de extrato bancário (OFX/CSV) sem dependências externas — cobre o
// formato comum de exportação dos bancos brasileiros. OFX é SGML (nem sempre
// bem-formado como XML), então a extração é por regex tag a tag, não por um
// parser XML de verdade.

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number; // positivo = crédito (entrada), negativo = débito (saída)
  externalId: string | null;
}

function tagValue(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>\\s*([^\\r\\n<]+)`, 'i'));
  return m ? m[1].trim() : null;
}

// "20260815120000[-3:GMT]" ou "20260815" → Date. Ignora timezone (granularidade de dia já basta pra conciliação).
function parseOfxDate(raw: string): Date | null {
  const digits = raw.replace(/\[.*$/, '').trim();
  const m = digits.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function parseOfx(content: string): ParsedTransaction[] {
  const blocks = content.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|<\/STMTTRN>)/gi) ?? [];
  const out: ParsedTransaction[] = [];
  for (const block of blocks) {
    const dtRaw = tagValue(block, 'DTPOSTED');
    const amtRaw = tagValue(block, 'TRNAMT');
    if (!dtRaw || !amtRaw) continue;
    const date = parseOfxDate(dtRaw);
    const amount = Number(amtRaw);
    if (!date || Number.isNaN(amount)) continue;
    const description = tagValue(block, 'MEMO') ?? tagValue(block, 'NAME') ?? 'Sem descrição';
    out.push({ date, description, amount, externalId: tagValue(block, 'FITID') });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  // Suporta ; ou , como separador e valores entre aspas.
  const sep = line.includes(';') ? ';' : ',';
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === sep && !inQuotes) { cells.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  cells.push(cur.trim());
  return cells.map((c) => c.replace(/^"|"$/g, ''));
}

function parseBrDate(raw: string): Date | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const year = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
    return new Date(year, Number(br[2]) - 1, Number(br[1]));
  }
  return null;
}

function parseBrNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;
  // "1.234,56" (BR) vs "1234.56" (US) — se tem vírgula, ela é o decimal.
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const n = Number(normalized);
  return Number.isNaN(n) ? null : n;
}

const HEADER_ALIASES = {
  date: ['data', 'date', 'dt'],
  description: ['descrição', 'descricao', 'histórico', 'historico', 'description', 'memo'],
  amount: ['valor', 'value', 'amount', 'montante'],
};

/**
 * CSV flexível: tenta reconhecer cabeçalho (data/descrição/valor, PT ou EN);
 * sem cabeçalho reconhecível, assume a ordem posicional data,descrição,valor.
 */
export function parseCsv(content: string): ParsedTransaction[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const headerCells = splitCsvLine(lines[0]).map((c) => c.toLowerCase());
  const findCol = (aliases: string[]) => headerCells.findIndex((h) => aliases.includes(h));
  let dateIdx = findCol(HEADER_ALIASES.date);
  let descIdx = findCol(HEADER_ALIASES.description);
  let amountIdx = findCol(HEADER_ALIASES.amount);

  const hasHeader = dateIdx !== -1 && amountIdx !== -1;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (!hasHeader) { dateIdx = 0; descIdx = 1; amountIdx = 2; }

  const out: ParsedTransaction[] = [];
  for (const line of dataLines) {
    const cells = splitCsvLine(line);
    const date = parseBrDate(cells[dateIdx] ?? '');
    const amount = parseBrNumber(cells[amountIdx] ?? '');
    if (!date || amount == null) continue;
    out.push({ date, description: cells[descIdx >= 0 ? descIdx : 1] ?? 'Sem descrição', amount, externalId: null });
  }
  return out;
}

export function parseBankStatement(content: string): ParsedTransaction[] {
  return /OFXHEADER|<OFX>/i.test(content) ? parseOfx(content) : parseCsv(content);
}
