// Benefícios de mensalidade. Dois tipos, ambos definidos no cadastro do irmão:
//  - isenção total (Maçom Remido): Member.duesExempt — fora da cobrança em massa e do Art. 002;
//  - só a parte da Potência: Member.duesPotencyOnly — o irmão é isento da parte da loja e a
//    mensalidade já nasce no valor da Potência (Lodge.powerDuesAmount). Continua cobrado e no Art. 002.
// Conceder ou retirar é ato do Venerável ou do Administrador.

import { ageInYears } from './masonic-degree';

export const POTENCY_REASONS = {
  age_tenure: 'Idade e tempo de Ordem',
  age70: 'Concessão da loja — mais de 70 anos',
  lodge: 'Concessão da loja — outro motivo',
} as const;
export type PotencyReason = keyof typeof POTENCY_REASONS;

export const AGE_CONCESSION_YEARS = 70;

export function isPotencyReason(v: unknown): v is PotencyReason {
  return typeof v === 'string' && v in POTENCY_REASONS;
}

export function canGrantDuesBenefit(role: string | null | undefined): boolean {
  const r = (role ?? '').toLowerCase().trim();
  return r === 'admin' || r === 'venerable';
}

/** Indicativo para a concessão da loja por idade: a decisão é sempre do Venerável/Administrador. */
export function eligibleForAgeConcession(birthDate?: string | Date | null, ref: Date = new Date()): boolean {
  const age = ageInYears(birthDate, ref);
  return age !== null && age >= AGE_CONCESSION_YEARS;
}

/** Valor da mensalidade do irmão: quem só paga a Potência recebe o valor da Potência (nunca acima do valor cheio). */
export function duesAmountFor(member: { duesPotencyOnly?: boolean | null }, base: number, potencyAmount: number | null | undefined): number {
  if (!member.duesPotencyOnly || !potencyAmount || potencyAmount <= 0) return base;
  return Math.min(base, potencyAmount);
}

export interface BenefitFields { duesExempt: boolean; duesPotencyOnly: boolean; duesPotencyReason: string | null }

/** Um benefício por vez; o motivo só existe junto da opção "só a Potência" (padrão: concessão da loja). */
export function normalizeBenefit(input: { duesExempt?: unknown; duesPotencyOnly?: unknown; duesPotencyReason?: unknown }): BenefitFields {
  const exempt = String(input.duesExempt) === 'true';
  const potency = !exempt && String(input.duesPotencyOnly) === 'true';
  return {
    duesExempt: exempt,
    duesPotencyOnly: potency,
    duesPotencyReason: potency ? (isPotencyReason(input.duesPotencyReason) ? input.duesPotencyReason : 'lodge') : null,
  };
}
