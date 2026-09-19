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
