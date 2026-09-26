// Exportação CSV (separador ";", padrão do Excel em pt-BR) segura para abrir em planilha.
// - Campo que começa com = + - @ (ou TAB/CR) viraria fórmula no Excel/Sheets ("CSV injection",
//   ex.: um nome de membro importado como =HYPERLINK(...)): recebe um apóstrofo na frente.
// - Campo com ; " ou quebra de linha vai entre aspas (aspas internas dobradas), senão desloca colunas.
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[;"\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(';');
}

/** Baixa as linhas como CSV no navegador (BOM + CRLF, para o Excel pt-BR abrir com acentos). */
export function downloadCsv(filename: string, rows: unknown[][]): void {
  const blob = new Blob(['﻿' + rows.map(csvRow).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Número no formato do Excel pt-BR (vírgula decimal, sem milhar), para colunas de valor. */
export const csvNumber = (n: number) => n.toFixed(2).replace('.', ',');
