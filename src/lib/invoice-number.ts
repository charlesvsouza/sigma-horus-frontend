/**
 * Próximos números de uma série `PREFIXO-AAAAMM-NNNN` a partir dos já existentes.
 *
 * Usa o MAIOR sufixo (não a contagem): se uma cobrança do mês for apagada, contar reaproveitaria
 * o número da última e duplicaria. Números fora do padrão (digitados à mão, com sufixo não
 * numérico) são ignorados no cálculo.
 */
export function nextSequenceNumbers(prefix: string, existing: string[], count: number): string[] {
  let max = 0;
  for (const number of existing) {
    if (!number.startsWith(prefix)) continue;
    const suffix = number.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    max = Math.max(max, Number(suffix));
  }
  return Array.from({ length: count }, (_, i) => `${prefix}${String(max + 1 + i).padStart(4, '0')}`);
}
