import type { Prisma } from '@/generated/prisma/client';
import { deletePayment, receivePaymentInCash } from '@/lib/asaas';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { withTenant } from '@/lib/prisma';

// Cobrança com boleto/Pix/cartão ativo no Asaas: emitida e ainda não paga.
const OPEN_ASAAS_STATUSES = ['billed', 'overdue'];

export interface OpenAsaasCharge { id: string; number: string; amount: number }

/**
 * Cobranças deste lançamento que estão abertas no Asaas. Se `memberId` vier
 * (conta compartilhada de cobrança em massa), só as desse membro.
 */
export async function findOpenAsaasCharges(
  db: Prisma.TransactionClient,
  params: { accountId: string; memberId?: string | null },
): Promise<OpenAsaasCharge[]> {
  const rows = await db.invoice.findMany({
    where: {
      accountId: params.accountId,
      asaasPaymentId: { not: null },
      status: { in: OPEN_ASAAS_STATUSES },
      ...(params.memberId ? { memberId: params.memberId } : {}),
    },
    select: { id: true, number: true, amount: true },
  });
  return rows.map((r) => ({ id: r.id, number: r.number, amount: Number(r.amount) }));
}

/** Corpo do 409 que o front usa para perguntar "recebido fora do Asaas?". */
export function asaasConflictBody(charges: OpenAsaasCharge[]) {
  const nums = charges.map((c) => c.number).join(', ');
  return {
    code: 'ASAAS_CHARGE_OPEN',
    error: `A cobrança ${nums} está aberta no Asaas. Se o valor foi recebido fora do Asaas, confirme para registrar a baixa e encerrar a cobrança lá; caso contrário aguarde a confirmação do Asaas.`,
  };
}

/**
 * Depois da baixa local (já commitada): avisa o Asaas que as cobranças que
 * ficaram quitadas foram recebidas fora dele. Ordem local→Asaas de propósito:
 * o Asaas responde com um webhook, que precisa encontrar a cobrança já paga.
 * Retorna um aviso (texto) se algo não pôde ser encerrado lá — a baixa local
 * permanece, pois o dinheiro realmente foi recebido.
 */
export async function notifyAsaasReceivedInCash(lodgeId: string, invoiceIds: string[], paidAt: Date): Promise<string | null> {
  if (invoiceIds.length === 0) return null;
  const ctx = await withTenant(lodgeId, async (db) => ({
    lodge: await db.lodge.findUnique({ where: { id: lodgeId }, select: { asaasApiKeyEnc: true, asaasEnv: true } }),
    invoices: await db.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, number: true, amount: true, status: true, asaasPaymentId: true } }),
  }));
  const config = buildLodgeAsaasConfig(ctx.lodge);
  const paymentDate = paidAt.toISOString().slice(0, 10);
  const warnings: string[] = [];

  for (const inv of ctx.invoices) {
    if (!inv.asaasPaymentId) continue;
    if (inv.status !== 'paid') {
      warnings.push(`${inv.number}: pagamento parcial — a cobrança segue aberta no Asaas pelo valor integral.`);
      continue;
    }
    if (!config) {
      warnings.push(`${inv.number}: Asaas não está conectado; encerre a cobrança manualmente no painel do Asaas.`);
      continue;
    }
    try {
      await receivePaymentInCash(config, inv.asaasPaymentId, { paymentDate, value: Number(inv.amount) });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'erro desconhecido';
      warnings.push(`${inv.number}: não foi possível encerrar no Asaas (${detail}). Encerre manualmente no painel do Asaas.`);
    }
  }
  return warnings.length > 0 ? `Baixa registrada, mas: ${warnings.join(' ')}` : null;
}

/**
 * Cancela no Asaas cobranças que deixaram de valer localmente (renegociação: novo
 * valor/vencimento). Best-effort, depois do commit; devolve um aviso se algo falhar.
 */
export async function cancelAsaasCharges(lodgeId: string, asaasPaymentIds: string[]): Promise<string | null> {
  if (asaasPaymentIds.length === 0) return null;
  const lodge = await withTenant(lodgeId, (db) => db.lodge.findUnique({ where: { id: lodgeId }, select: { asaasApiKeyEnc: true, asaasEnv: true } }));
  const config = buildLodgeAsaasConfig(lodge);
  if (!config) return `Cobrança(s) do Asaas não canceladas (Asaas desconectado): encerre no painel do Asaas — ${asaasPaymentIds.join(', ')}.`;
  const failed: string[] = [];
  for (const id of asaasPaymentIds) {
    try {
      await deletePayment(config, id);
    } catch {
      failed.push(id);
    }
  }
  return failed.length > 0 ? `Não foi possível cancelar no Asaas: ${failed.join(', ')}. Cancele no painel do Asaas para o irmão não pagar o valor antigo.` : null;
}
