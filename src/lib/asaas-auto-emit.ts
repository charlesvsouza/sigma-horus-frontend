import { emitInvoiceCharge } from '@/lib/asaas-charge';
import { autoEmitWindow, decideAutoEmit } from '@/lib/asaas-auto-emit-rules';
import { prismaAdmin, withTenant } from '@/lib/prisma';

// Emissão automática no Asaas (opt-in por loja: Lodge.asaasAutoEmit, só no Modo Asaas).
// A recorrência cria a mensalidade no próprio dia do vencimento e a emissão era um clique
// do Tesoureiro — o lembrete saía sem Pix. Agora a rotina da manhã (cron recurring-invoices,
// 07:00 UTC, antes dos lembretes das 11:00) emite o que ainda não foi emitido e vence de hoje
// até AUTO_EMIT_DAYS_AHEAD dias. Vencida e não emitida NÃO entra: emitir atraso em lote é
// decisão da Tesouraria (ou do irmão, pelo Pagar do portal).

export { AUTO_EMIT_DAYS_AHEAD } from '@/lib/asaas-auto-emit-rules';
export const AUTO_EMIT_ACTOR = 'system:asaas-auto-emit';

export interface AutoEmitResult {
  emitted: number;
  skippedNoCpf: number;
  errors: number;
}

export async function autoEmitForLodge(lodgeId: string, now: Date = new Date()): Promise<AutoEmitResult> {
  const { from, to } = autoEmitWindow(now);
  const invoices = await withTenant(lodgeId, (db) =>
    db.invoice.findMany({
      where: { lodgeId, status: 'pending', asaasPaymentId: null, memberId: { not: null }, dueDate: { gte: from, lte: to } },
      select: {
        id: true, amount: true,
        member: { select: { cpf: true } },
        account: { select: { memberId: true, amount: true, status: true, payments: { select: { amount: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    }),
  );

  const result: AutoEmitResult = { emitted: 0, skippedNoCpf: 0, errors: 0 };
  for (const inv of invoices) {
    const decision = decideAutoEmit({
      invoiceId: inv.id,
      invoiceAmount: Number(inv.amount),
      memberCpf: inv.member?.cpf ?? null,
      accountMemberId: inv.account.memberId,
      accountAmount: Number(inv.account.amount),
      accountStatus: inv.account.status,
      accountPaid: inv.account.payments.map((p) => Number(p.amount)),
    });
    if (!decision.emit) {
      if (decision.reason === 'no-cpf') result.skippedNoCpf++;
      continue;
    }
    // Uma por vez: cada emissão faz rede (Asaas) fora de transação, como o clique da Tesouraria.
    const r = await emitInvoiceCharge({ lodgeId, invoiceId: inv.id, actorId: AUTO_EMIT_ACTOR, value: decision.value });
    if (r.ok) result.emitted++;
    else {
      console.error('emissão automática Asaas: falha', { lodgeId, invoiceId: inv.id, error: r.error });
      result.errors++;
    }
  }
  return result;
}

/** Cron: lojas ativas no Modo Asaas com a emissão automática ligada e o Asaas pronto. */
export async function autoEmitAllLodges(now: Date = new Date()): Promise<AutoEmitResult & { lodges: number }> {
  const lodges = await prismaAdmin.lodge.findMany({
    where: {
      status: 'active',
      collectionMode: 'asaas',
      asaasAutoEmit: true,
      asaasApiKeyEnc: { not: null },
      asaasSettlementAccountId: { not: null },
    },
    select: { id: true },
  });
  const total = { lodges: lodges.length, emitted: 0, skippedNoCpf: 0, errors: 0 };
  for (const { id } of lodges) {
    try {
      const r = await autoEmitForLodge(id, now);
      total.emitted += r.emitted; total.skippedNoCpf += r.skippedNoCpf; total.errors += r.errors;
    } catch (err) {
      console.error('emissão automática Asaas: falha na loja', { lodgeId: id, err });
      total.errors++;
    }
  }
  return total;
}
