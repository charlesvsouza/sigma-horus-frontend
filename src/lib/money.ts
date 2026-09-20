// Dinheiro no banco é Float (double): somas e comparações diretas falham por
// erro de ponto flutuante — ex.: 10,10 + 20,20 = 30,299999… < 30,30, e a conta
// paga em duas parcelas ficava "aberta". Tudo que soma/compara valores passa por
// aqui, sempre em centavos inteiros.

/** Arredonda para 2 casas (centavos). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Soma valores em centavos inteiros (sem acumular erro de ponto flutuante). */
export function sumMoney(values: number[]): number {
  return values.reduce((acc, v) => acc + Math.round(v * 100), 0) / 100;
}

/** `paid` cobre `amount`? (comparação em centavos) */
export function coversAmount(paid: number, amount: number): boolean {
  return Math.round(paid * 100) >= Math.round(amount * 100);
}

/** Quanto falta pagar (nunca negativo). */
export function remainingAmount(amount: number, paid: number): number {
  return Math.max(0, (Math.round(amount * 100) - Math.round(paid * 100)) / 100);
}

/**
 * Finito, com no máximo 2 casas decimais (tolera o ruído de ponto flutuante, ex.: 0.1 * 3) e
 * dentro do que cabe em numeric(14,2). Aceita zero e negativo — quem chama decide o sinal.
 */
export function hasAtMostCents(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n) <= 1e12 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

/** Valor monetário válido para lançar: número finito, maior que zero e com no máximo 2 casas. */
export function isValidMoney(n: unknown): n is number {
  return typeof n === 'number' && n > 0 && hasAtMostCents(n);
}
