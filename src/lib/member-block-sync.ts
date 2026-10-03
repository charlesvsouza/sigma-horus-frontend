import type { Prisma } from '@/generated/prisma/client';
import { remainingAmount } from '@/lib/money';

// Parte enxuta do acordo de regularização (só leitura/atualização de status): fica à parte de
// member-block-server para os pontos de baixa (webhook, estorno, pagamentos) poderem chamá-la sem
// arrastar auditoria, Asaas e e-mail — e para continuar testável com um banco falso.

type Db = Prisma.TransactionClient;

/** Saldo atual de cada item (as dívidas seguem sendo as próprias contas; pagar em qualquer lugar abate aqui). */
export async function itemRemainders(db: Db, items: { accountId: string }[]): Promise<Map<string, number>> {
  const accounts = await db.account.findMany({
    where: { id: { in: items.map((i) => i.accountId) } },
    select: { id: true, amount: true, status: true, payments: { select: { amount: true } } },
  });
  const out = new Map<string, number>();
  for (const a of accounts) {
    const paid = a.payments.reduce((s, p) => s + Number(p.amount), 0);
    out.set(a.id, a.status === 'paid' ? 0 : remainingAmount(Number(a.amount), paid));
  }
  return out; // conta que não existe mais = fora do mapa = sem saldo
}

/**
 * Mantém o acordo em dia com os pagamentos: tudo pago → "quitado" (aguarda o retorno do irmão);
 * saldo reaberto por um estorno → volta a "aberto". Chamado onde o quadro financeiro do irmão muda
 * (baixa, exclusão, webhook do Asaas, estorno).
 */
export async function syncMemberBlock(db: Db, lodgeId: string, memberId: string, now: Date = new Date()): Promise<void> {
  const block = await db.memberBlock.findFirst({ where: { lodgeId, memberId, status: { in: ['open', 'settled'] } }, include: { items: true } });
  if (!block) return;
  const rem = await itemRemainders(db, block.items);
  const allPaid = block.items.every((i) => (rem.get(i.accountId) ?? 0) <= 0);
  if (allPaid && block.status === 'open') {
    await db.memberBlock.update({ where: { id: block.id }, data: { status: 'settled', settledAt: now } });
  } else if (!allPaid && block.status === 'settled') {
    await db.memberBlock.update({ where: { id: block.id }, data: { status: 'open', settledAt: null } });
  }
}
