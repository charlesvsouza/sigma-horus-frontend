// Fonte única de formatação de moeda — evita a mistura de `.toFixed(2)`
// (decimal com ponto, sem separador de milhar) e `toLocaleString` espalhada
// pelo dashboard.
export function brl(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
