// Regra única de "a loja pode usar o sistema?", compartilhada pela tela
// (dashboard/layout) e pela API (lib/subscription-guard). Função pura.

export type SubscriptionSnapshot = {
  status: string;
  trialEndsAt: Date | null;
} | null;

export type SubscriptionAccess =
  | { blocked: false; reason: null }
  | { blocked: true; reason: 'trial_expired' | 'inactive' };

/**
 * Libera quem está `active` ou em `trialing` com prazo ainda por vir. Qualquer outro caso
 * (sem assinatura, inativa, cancelada, em atraso, teste vencido) fica bloqueado.
 */
export function subscriptionAccess(sub: SubscriptionSnapshot, now: number = Date.now()): SubscriptionAccess {
  if (sub?.status === 'active') return { blocked: false, reason: null };
  const trialEnds = sub?.trialEndsAt ? sub.trialEndsAt.getTime() : null;
  if (sub?.status === 'trialing' && trialEnds !== null) {
    return trialEnds > now ? { blocked: false, reason: null } : { blocked: true, reason: 'trial_expired' };
  }
  return { blocked: true, reason: 'inactive' };
}
