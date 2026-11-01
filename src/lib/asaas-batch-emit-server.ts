import { agreementDebtAccountIds } from '@/lib/agreement-items';
import { decideBatchEmit, type BatchSkipReason } from '@/lib/asaas-batch-emit';
import { chargeUrgency } from '@/lib/charge-notice';
import { isAsaasMode } from '@/lib/collection';
import { withTenant } from '@/lib/prisma';

export interface BatchItem {
  invoiceId: string;
  number: string;
  memberId: string | null;
  memberName: string;
  dueDate: string;
  overdue: boolean;
  /** Valor que seria emitido (saldo em aberto); null quando a cobrança fica de fora. */
  value: number | null;
  skip: BatchSkipReason | null;
}

export type BatchLoad =
  | { ready: true; billingType: string; items: BatchItem[] }
  | { ready: false; status: number; error: string };

/** Cobranças em aberto ainda não emitidas no Asaas da loja, já com a decisão de cada uma. Só leitura. */
export async function loadBatchEmit(lodgeId: string, now: Date = new Date()): Promise<BatchLoad> {
  const data = await withTenant(lodgeId, async (db) => {
    const lodge = await db.lodge.findUnique({
      where: { id: lodgeId },
      select: { collectionMode: true, asaasApiKeyEnc: true, asaasSettlementAccountId: true, asaasBillingType: true },
    });
    if (!lodge) return null;
    const settlement = lodge.asaasSettlementAccountId
      ? await db.financialAccount.findFirst({ where: { id: lodge.asaasSettlementAccountId, lodgeId, active: true, kind: 'bank', isInvestment: false }, select: { id: true } })
      : null;
    const invoices = await db.invoice.findMany({
      where: { lodgeId, status: { in: ['pending', 'overdue'] }, asaasPaymentId: null },
      select: {
        id: true, number: true, amount: true, dueDate: true, status: true, memberId: true, accountId: true,
        member: { select: { name: true, cpf: true } },
        account: { select: { memberId: true, amount: true, status: true, payments: { select: { amount: true } }, degreeFeePlan: { select: { paymentMethod: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    });
    const inAgreement = await agreementDebtAccountIds(db, lodgeId);
    return { lodge, settlement, invoices, inAgreement };
  });
  if (!data) return { ready: false, status: 404, error: 'Loja não encontrada.' };
  const { lodge, settlement, invoices, inAgreement } = data;

  if (!isAsaasMode(lodge)) return { ready: false, status: 409, error: 'Esta loja recebe no Modo Loja. Para emitir no Asaas, mude o modo em Configurações da loja → Recebimento das cobranças.' };
  if (!lodge.asaasApiKeyEnc) return { ready: false, status: 409, error: 'Asaas não conectado para esta loja. Configure em Integrações.' };
  if (!settlement) return { ready: false, status: 409, error: 'Escolha a conta corrente que recebe o repasse do Asaas (ativa, do tipo banco) em Configurações da loja → Recebimento das cobranças. Sem ela o Asaas não emite.' };

  const items: BatchItem[] = invoices.map((inv) => {
    const decision = decideBatchEmit({
      invoiceId: inv.id,
      invoiceAmount: Number(inv.amount),
      memberCpf: inv.member?.cpf ?? null,
      accountMemberId: inv.account.memberId,
      accountAmount: Number(inv.account.amount),
      accountStatus: inv.account.status,
      accountPaid: inv.account.payments.map((p) => Number(p.amount)),
      hasMember: !!inv.memberId,
      inAgreement: inAgreement.has(inv.accountId),
      cardPlan: inv.account.degreeFeePlan?.paymentMethod === 'card',
    });
    return {
      invoiceId: inv.id,
      number: inv.number,
      memberId: inv.memberId,
      memberName: inv.member?.name ?? '—',
      dueDate: inv.dueDate.toISOString(),
      overdue: chargeUrgency(inv.dueDate, inv.status, now) === 'overdue',
      value: decision.emit ? decision.value : null,
      skip: decision.emit ? null : decision.reason,
    };
  });
  return { ready: true, billingType: lodge.asaasBillingType ?? 'PIX', items };
}
