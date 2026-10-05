// Números que chegam do corpo da requisição e vão para colunas Int do banco. Sem faixa, 1.5, 1e10 ou NaN
// viravam erro 500 do Prisma (ou um valor absurdo gravado). Aceita número ou texto numérico; devolve null
// quando não é inteiro ou está fora da faixa — quem chama responde 400.

export function intInRange(raw: unknown, min: number, max: number): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Limite de ocorrências de uma recorrência (50 anos de mensalidade). */
export const MAX_RECURRING_COUNT = 600;
export const MAX_MATERIAL_QUANTITY = 1_000_000;
export const MAX_DISPLAY_ORDER = 9999;
