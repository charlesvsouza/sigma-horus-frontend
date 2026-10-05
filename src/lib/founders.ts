import { todayBR } from '@/lib/date-only';
import { prismaAdmin } from '@/lib/prisma';

// Oferta de lançamento "Lojas Fundadoras" (decisão do dono, 2026-09-27): as primeiras 30 lojas
// que ASSINAREM um plano (assinatura paga, não o teste grátis) mantêm o preço do plano por 24
// meses e recebem o selo de Loja Fundadora. O preço travado sai naturalmente do Stripe (a
// assinatura guarda o Price da contratação) — por isso assinaturas de fundadoras NÃO devem ser
// migradas para Prices novos antes de 24 meses.
//
// Decisão do dono (2026-10-05): as vagas passam a ser os DIAS que faltam para acabar o teste da primeira loja
// (amm139) — uma a menos por dia — e a oferta termina junto com esse teste. Cada assinatura paga também ocupa
// uma vaga. Sem a data do teste (banco fora do ar, teste já encerrado), a seção some: nunca promete o que não dá para provar.

export const FOUNDER_SLOTS = 30;
export const FOUNDER_PRICE_LOCK_MONTHS = 24;

/** Loja cujo fim de teste encerra a oferta. */
export const FOUNDER_OFFER_LODGE_SLUG = process.env.FOUNDER_OFFER_LODGE_SLUG || 'amm139';

/** Vagas restantes por assinaturas (nunca negativo) — regra antiga, mantida como teto. */
export function foundersLeft(paidLodges: number, slots = FOUNDER_SLOTS): number {
  return Math.max(0, slots - Math.max(0, paidLodges));
}

/** Dias de Brasília entre hoje e o fim da oferta (0 ou menos = encerrada). */
export function foundersDaysLeft(offerEnd: Date, now: Date = new Date()): number {
  return Math.round((todayBR(offerEnd).getTime() - todayBR(now).getTime()) / 86_400_000);
}

/** Vagas = dias restantes (no máximo as vagas totais) menos as assinaturas pagas; nunca negativo. */
export function foundersSlotsLeft(daysLeft: number, paidLodges: number): number {
  return Math.max(0, Math.min(FOUNDER_SLOTS, daysLeft) - Math.max(0, paidLodges));
}

/** Fim da oferta = fim do teste da loja de referência. Null se não der para saber (a seção some). */
export async function founderOfferEnd(): Promise<Date | null> {
  try {
    const sub = await prismaAdmin.subscription.findFirst({ where: { lodge: { slug: FOUNDER_OFFER_LODGE_SLUG } }, select: { trialEndsAt: true } });
    // Vale a data do teste mesmo que a loja assine antes: a oferta termina no dia em que o teste terminaria.
    return sub?.trialEndsAt ?? null;
  } catch {
    return null;
  }
}

/** Contagem pública para a landing: lojas com assinatura paga. Null se o banco não responder (a seção some o contador). */
export async function countPaidLodges(): Promise<number | null> {
  try {
    return await prismaAdmin.subscription.count({ where: { status: 'active' } });
  } catch {
    return null;
  }
}
