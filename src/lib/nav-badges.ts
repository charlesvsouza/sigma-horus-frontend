// Avisos numéricos do menu lateral ("o que está esperando você"). Regras puras, sem banco: o layout carrega
// as linhas e chama estas funções. Cada aviso tem um tom: 'alerta' (vermelho, algo atrasado) ou 'atencao' (dourado).

export type NavBadgeTone = 'alerta' | 'atencao';
export interface NavBadge { count: number; tone: NavBadgeTone; hint: string }

/** Contas distintas com aviso "Já paguei" ainda valendo (uma recusa posterior invalida os avisos anteriores). */
export function pendingNoticeAccountIds(
  notices: { entityId: string; createdAt: Date }[],
  rejections: { entityId: string; createdAt: Date }[],
): string[] {
  const lastRejection = new Map<string, number>();
  for (const r of rejections) {
    const t = r.createdAt.getTime();
    if (t > (lastRejection.get(r.entityId) ?? 0)) lastRejection.set(r.entityId, t);
  }
  const ids = new Set<string>();
  for (const n of notices) if (n.createdAt.getTime() > (lastRejection.get(n.entityId) ?? 0)) ids.add(n.entityId);
  return [...ids];
}

/** Itens que apareceram como "a conferir" e ainda não têm confirmação. */
export function pendingWithoutConfirmation(pending: { entityId: string }[], confirmed: { entityId: string }[]): string[] {
  const done = new Set(confirmed.map((c) => c.entityId));
  return [...new Set(pending.map((p) => p.entityId))].filter((id) => !done.has(id));
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Monta o aviso só quando há algo a mostrar. */
export function badge(count: number, tone: NavBadgeTone, hint: (n: number) => string): NavBadge | null {
  return count > 0 ? { count, tone, hint: hint(count) } : null;
}

/** Soma dos avisos de uma lista de itens (mostrada na categoria quando ela está recolhida). */
export function sumBadges(badges: (NavBadge | undefined)[]): number {
  return badges.reduce((acc, b) => acc + (b?.count ?? 0), 0);
}

/** Texto curto do número no menu (99+ para não quebrar a linha). */
export const badgeText = (count: number) => (count > 99 ? '99+' : String(count));
