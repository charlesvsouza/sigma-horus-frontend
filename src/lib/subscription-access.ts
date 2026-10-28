// Regra única de "a loja pode usar o sistema?", compartilhada pela tela
// (dashboard/layout) e pela API (lib/subscription-guard). Função pura.

export type SubscriptionSnapshot = {
  status: string;
  trialEndsAt: Date | null;
  /** Início do atraso do pagamento (status past_due). */
  pastDueSince?: Date | null;
} | null;

export type SubscriptionAccess =
  | { blocked: false; reason: null }
  | { blocked: true; reason: 'trial_expired' | 'inactive' | 'past_due_expired' };

/** Dias de tolerância de uma assinatura com pagamento em atraso antes de bloquear a loja. */
export const PAST_DUE_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pagamento em atraso DENTRO da tolerância: o sistema segue liberado, mas a Diretoria (Administrador, Venerável e
 * Tesoureiro) é avisada. Devolve o prazo final e os dias que restam; `null` se não está em atraso ou a tolerância já acabou.
 */
export function pastDueGrace(sub: SubscriptionSnapshot, now: number = Date.now()): { endsAt: Date; daysLeft: number } | null {
  if (sub?.status !== 'past_due' || !sub.pastDueSince) return null;
  const endsAt = new Date(sub.pastDueSince.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS);
  if (endsAt.getTime() <= now) return null;
  return { endsAt, daysLeft: Math.ceil((endsAt.getTime() - now) / DAY_MS) };
}

/**
 * Libera quem está `active`, em `trialing` com prazo ainda por vir ou em `past_due` dentro dos 30 dias de tolerância.
 * Qualquer outro caso (sem assinatura, inativa, cancelada, teste vencido, atraso de mais de 30 dias) fica bloqueado.
 */
export function subscriptionAccess(sub: SubscriptionSnapshot, now: number = Date.now()): SubscriptionAccess {
  if (sub?.status === 'active') return { blocked: false, reason: null };
  if (sub?.status === 'past_due') {
    return pastDueGrace(sub, now) ? { blocked: false, reason: null } : { blocked: true, reason: 'past_due_expired' };
  }
  const trialEnds = sub?.trialEndsAt ? sub.trialEndsAt.getTime() : null;
  if (sub?.status === 'trialing' && trialEnds !== null) {
    return trialEnds > now ? { blocked: false, reason: null } : { blocked: true, reason: 'trial_expired' };
  }
  return { blocked: true, reason: 'inactive' };
}
