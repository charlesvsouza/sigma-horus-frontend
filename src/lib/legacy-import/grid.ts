// Leitura de planilhas de outros sistemas (CSV e XLSX) numa grade de textos.
//
// Os relatórios exportados por sistemas legados (Cenize/Loje e similares) não
// são "tabelas" no sentido de banco de dados: são páginas de impressão. No CSV
// as colunas mudam de posição de uma página para outra; no XLSX (conversão de
// PDF) as células ficam mescladas, com o texto de uma linha espalhado em
// várias células. Por isso esta camada só entrega o TEXTO de cada célula, sem
// interpretar nada — quem interpreta são os parsers de cada relatório.

export interface Grid {
  name: string; // nome da aba (CSV: nome do arquivo)
  rows: string[][];
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Decodifica bytes de CSV: UTF-8 quando válido, senão ISO-8859-1 (padrão dos sistemas antigos). */
export function decodeText(buffer: Buffer): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  } catch {
    return buffer.toString('latin1');
  }
}

/** CSV com aspas (RFC 4180), separador `;` ou `,` (detectado pela 1ª linha não vazia), quebras de linha dentro de aspas. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const sep = semicolons >= commas && semicolons > 0 ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  // Só o fim é aparado: o recuo à esquerda carrega a hierarquia do plano de contas (Razão/Balancete).
  return rows.map((r) => r.map((c) => c.replace(/\s+$/, '')));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cellToText(cell: any): string | null {
  // Célula mesclada: só o canto superior esquerdo carrega o valor; as demais
  // repetem o mesmo texto e duplicariam tudo.
  if (cell.isMerged && cell.master && cell.master.address !== cell.address) return null;
  let v = cell.value;
  if (v == null) return null;
  if (v instanceof Date) return `${pad2(v.getUTCDate())}/${pad2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) v = v.richText.map((r: { text: string }) => r.text).join('');
    else if ('result' in v) v = v.result;
    else if ('text' in v) v = v.text;
    else return null;
    if (v instanceof Date) return `${pad2(v.getUTCDate())}/${pad2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  }
  const raw = String(v ?? '');
  const lead = raw.match(/^\s*/)?.[0].length ?? 0;
  const s = ' '.repeat(lead) + raw.trim().replace(/\s+/g, ' ');
  return s.trim() === '' ? null : s;
}

export class UnsupportedFormatError extends Error {}

/** Lê CSV ou XLSX. `.xls` binário antigo não é suportado — o erro diz como converter. */
export async function readGrids(file: { name: string; buffer: Buffer }): Promise<Grid[]> {
  const { name, buffer } = file;
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK" — xlsx é um zip
  const isOle = buffer.length > 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;

  if (isOle) {
    throw new UnsupportedFormatError(
      `"${name}" está no formato Excel antigo (.xls). Abra no Excel e use Salvar como → Pasta de Trabalho do Excel (.xlsx) ou CSV, e envie de novo.`,
    );
  }

  if (isZip || /\.xlsx$/i.test(name)) {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    // Buffer do exceljs não usa o parâmetro genérico do @types/node atual — mesmo valor em runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    return workbook.worksheets.map((sheet) => {
      const rows: string[][] = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cells[col - 1] = cellToText(cell) ?? '';
        });
        for (let i = 0; i < cells.length; i++) cells[i] ??= '';
        if (cells.some((c) => c.trim() !== '')) rows.push(cells);
      });
      return { name: sheet.name, rows };
    });
  }

  return [{ name, rows: parseCsv(decodeText(buffer)) }];
}

/** Todos os textos não vazios da grade, na ordem de leitura (linha a linha, coluna a coluna). */
export function flattenCells(grid: Grid): string[] {
  const out: string[] = [];
  for (const row of grid.rows) for (const c of row) if (c.trim() !== '') out.push(c.trim());
  return out;
}
