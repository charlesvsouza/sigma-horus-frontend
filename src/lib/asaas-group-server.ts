import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { createCustomer, createPayment, deletePayment } from '@/lib/asaas';
import { asaasDueDate, fetchPixQr, type PixQr } from '@/lib/asaas-charge';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { allocateGroupPayment, GROUP_REF_PREFIX } from '@/lib/asaas-group';
import { settleAsaasInvoicePayment } from '@/lib/asaas-settlement';
import { logAudit } from '@/lib/audit';
import { isAsaasMode } from '@/lib/collection';
import { remainingAmount, sumMoney } from '@/lib/money';
import { withTenant } from '@/lib/prisma';
import { detachGroupSiblings } from '@/lib/asaas-group-db';

export { detachGroupSiblings };

type Db = Prisma.TransactionClient;

/** Quanto falta numa cobrança: saldo da conta do membro (1:1) ou, em conta compartilhada, da parte dele. */
function openOf(inv: { amount: number; memberId: string | null; account: { memberId: string | null; amount: number; payments: { amount: number; memberId: string | null }[] } }): number {
  if (inv.account.memberId) return remainingAmount(Number(inv.account.amount), sumMoney(inv.account.payments.map((p) => Number(p.amount))));
  const mine = inv.account.payments.filter((p) => p.memberId === inv.memberId).map((p) => Number(p.amount));
  return remainingAmount(Number(inv.amount), sumMoney(mine));
}

/**
 * Baixa de um Pix agrupado: divide o valor (e a tarifa) entre as cobranças ainda abertas do
 * grupo, da mais antiga para a mais nova, e baixa cada uma pelo fluxo normal
 * (settleAsaasInvoicePayment — idempotente por conta). Roda dentro da transação de quem chama.
 */
export async function settleAsaasGroupPayment(
  db: Db,
  params: { lodgeId: string; asaasPaymentId: string; total: number; netValue: number | null; billingType: string | null; userId: string; source: string },
): Promise<{ settled: number; memberIds: string[] }> {
  const invoices = await db.invoice.findMany({
    where: { lodgeId: params.lodgeId, asaasPaymentId: params.asaasPaymentId, status: { not: 'paid' } },
    select: {
      id: true, amount: true, memberId: true, accountId: true,
      account: { select: { memberId: true, amount: true, payments: { select: { amount: true, memberId: true } } } },
    },
    orderBy: [{ dueDate: 'asc' }, { number: 'asc' }],
  });
  const allocations = allocateGroupPayment(
    invoices.map((inv) => ({ invoiceId: inv.id, open: openOf({ ...inv, amount: Number(inv.amount) }) })),
    params.total,
    params.netValue,
  );
  const byId = new Map(invoices.map((i) => [i.id, i]));
  for (const a of allocations) {
    const inv = byId.get(a.invoiceId)!;
    await settleAsaasInvoicePayment(db, {
      lodgeId: params.lodgeId,
      invoiceId: inv.id,
      accountId: inv.accountId,
      memberId: inv.memberId,
      amount: a.amount,
      netValue: a.netValue,
      billingType: params.billingType,
      asaasPaymentId: params.asaasPaymentId,
      userId: params.userId,
      source: `${params.source}:grupo`,
    });
  }
  return { settled: allocations.length, memberIds: [...new Set(invoices.map((i) => i.memberId).filter((m): m is string => Boolean(m)))] };
}

export type GroupEmitResult =
  | { ok: true; asaasPaymentId: string | null; invoiceUrl: string | null; pix: PixQr | null; total: number }
  | { ok: false; status: number; error: string };

/**
 * Emite UM Pix no Asaas para várias cobranças do mesmo irmão. Cancela antes as cobranças do
 * Asaas que elas já tinham (senão o irmão poderia pagar duas vezes) e solta as irmãs de
 * grupos antigos. `items` = cobrança + valor que cabe a ela (o saldo em aberto).
 */
export async function emitGroupCharge(params: {
  lodgeId: string;
  memberId: string;
  items: { invoiceId: string; value: number }[];
  actorId: string;
  missingCpfError?: string;
}): Promise<GroupEmitResult> {
  const { lodgeId, memberId, items, actorId } = params;
  if (items.length < 2) return { ok: false, status: 400, error: 'Escolha pelo menos duas contas para pagar juntas.' };

  const ctx = await withTenant(lodgeId, async (db) => ({
    lodge: await db.lodge.findUnique({ where: { id: lodgeId }, select: { asaasApiKeyEnc: true, asaasEnv: true, collectionMode: true, asaasSettlementAccountId: true } }),
    member: await db.member.findFirst({ where: { id: memberId, lodgeId }, select: { id: true, name: true, email: true, phone: true, cpf: true, asaasCustomerId: true } }),
    invoices: await db.invoice.findMany({
      where: { lodgeId, id: { in: items.map((i) => i.invoiceId) }, memberId, status: { not: 'paid' } },
      select: { id: true, number: true, asaasPaymentId: true },
    }),
  }));
  if (!isAsaasMode(ctx.lodge)) return { ok: false, status: 409, error: 'Esta loja não está no Modo Asaas.' };
  if (!ctx.lodge?.asaasSettlementAccountId) return { ok: false, status: 409, error: 'A loja ainda não escolheu a conta de repasse do Asaas. Fale com a Tesouraria.' };
  const config = buildLodgeAsaasConfig(ctx.lodge);
  if (!config) return { ok: false, status: 409, error: 'O pagamento online ainda não está disponível nesta loja. Fale com a Tesouraria.' };
  const member = ctx.member;
  if (!member) return { ok: false, status: 404, error: 'Cadastro de membro não encontrado.' };
  if (!member.cpf) return { ok: false, status: 400, error: params.missingCpfError ?? 'O membro precisa ter CPF cadastrado para emitir no Asaas.' };
  if (ctx.invoices.length !== items.length) return { ok: false, status: 409, error: 'Alguma das contas escolhidas não está mais em aberto. Recarregue a página.' };

  const total = sumMoney(items.map((i) => i.value));
  const numbers = ctx.invoices.map((i) => i.number).sort();
  const oldIds = [...new Set(ctx.invoices.map((i) => i.asaasPaymentId).filter((id): id is string => Boolean(id)))];

  let customerId = member.asaasCustomerId;
  const createdCustomer = !customerId;
  try {
    if (!customerId) {
      const customer = await createCustomer(config, { name: member.name, email: member.email ?? undefined, cpfCnpj: member.cpf, phone: member.phone ?? undefined });
      customerId = customer?.id ?? null;
    }
    if (!customerId) return { ok: false, status: 502, error: 'Falha ao criar/obter o cliente no Asaas.' };

    // Cobranças anteriores destas contas (individuais ou de outro grupo): cancela primeiro.
    for (const id of oldIds) {
      try {
        await deletePayment(config, id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/404|not.?found|n[ãa]o.?encontr/i.test(message)) {
          return { ok: false, status: 502, error: `Não foi possível cancelar uma cobrança anterior no Asaas: ${message}. Tente de novo.` };
        }
      }
    }

    const payment = await createPayment(config, {
      customer: customerId,
      billingType: 'PIX',
      value: total,
      dueDate: asaasDueDate(new Date()),
      description: `Pagamento agrupado de ${items.length} pendências (${numbers.join(', ')})`.slice(0, 480),
      externalReference: `${GROUP_REF_PREFIX}${randomUUID()}`,
    });
    const asaasPaymentId: string | null = payment?.id ?? null;
    const invoiceUrl: string | null = payment?.invoiceUrl ?? null;

    await withTenant(lodgeId, async (db) => {
      if (createdCustomer && customerId) await db.member.update({ where: { id: member.id }, data: { asaasCustomerId: customerId } });
      // Irmãs de grupos antigos que NÃO entraram neste: o Pix delas foi apagado acima.
      await detachGroupSiblings(db, lodgeId, oldIds, items.map((i) => i.invoiceId));
      await db.invoice.updateMany({
        where: { lodgeId, id: { in: items.map((i) => i.invoiceId) } },
        data: { status: 'billed', asaasPaymentId, asaasInvoiceUrl: invoiceUrl },
      });
      await logAudit(db, {
        lodgeId,
        userId: actorId,
        action: 'UPDATE',
        entity: 'invoice',
        entityId: items[0].invoiceId,
        metadata: { action: 'asaas_group_charge', asaasPaymentId, total, invoices: items },
      });
    });

    const pix = asaasPaymentId ? await fetchPixQr(config, asaasPaymentId) : null;
    return { ok: true, asaasPaymentId, invoiceUrl, pix, total };
  } catch (err) {
    return { ok: false, status: 502, error: err instanceof Error ? err.message : 'Erro ao emitir o Pix agrupado no Asaas.' };
  }
}
