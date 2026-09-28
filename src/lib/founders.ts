import { prismaAdmin } from '@/lib/prisma';

// Oferta de lançamento "Lojas Fundadoras" (decisão do dono, 2026-09-27): as primeiras 30 lojas
// que ASSINAREM um plano (assinatura paga, não o teste grátis) mantêm o preço do plano por 24
// meses e recebem o selo de Loja Fundadora. O preço travado sai naturalmente do Stripe (a
// assinatura guarda o Price da contratação) — por isso assinaturas de fundadoras NÃO devem ser
// migradas para Prices novos antes de 24 meses.

export const FOUNDER_SLOTS = 30;
export const FOUNDER_PRICE_LOCK_MONTHS = 24;

/** Vagas restantes (nunca negativo). */
export function foundersLeft(paidLodges: number, slots = FOUNDER_SLOTS): number {
  return Math.max(0, slots - Math.max(0, paidLodges));
}

/** Contagem pública para a landing: lojas com assinatura paga. Null se o banco não responder (a seção some o contador). */
export async function countPaidLodges(): Promise<number | null> {
  try {
    return await prismaAdmin.subscription.count({ where: { status: 'active' } });
  } catch {
    return null;
  }
}
