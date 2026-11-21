import { logAudit } from '@/lib/audit';
import { coversAmount } from '@/lib/money';
import { lockKey } from '@/lib/locks';
import { dateOnlyUTC, todayBR } from '@/lib/date-only';
import { syncMemberBlock } from '@/lib/member-block-sync';
import { withTenant } from '@/lib/prisma';
import type { ProviderChargeStatus } from '@/lib/billing-provider';

/**
 * Baixa automática do Pix recebido no banco (sem webhook, sem extrato importado).
 *
 * O cron consulta a cobrança no banco pelo txid; quando ela está CONCLUÍDA, esta função lança o
 * recebimento como um pagamento comum de Pix: `settlementType = 'bank_auto'`, na conta corrente
 * escolhida em Configurações → Integrações (a mesma onde o dinheiro caiu de fato). Não há tarifa
 * da plataforma aqui — o dinheiro entrou direto na conta da loja.
 *
 * Idempotência: uma baixa por Pix recebido (`endToEndId`) ou por cobrança. O cron pode rodar
 * quantas vezes for: o segundo laço encontra o pagamento e devolve o que já existe.
 */

export type SettleBankPixResult =
  | { ok: true; paymentId: string; alreadySettled: boolean }
  | { ok: false; status: number; error: string };

export async function settleBankPixReceipt(
  lodgeId: string,
  invoiceId: string,
  providerId: string,
  status: ProviderChargeStatus,
  userId: string,
): Promise<SettleBankPixResult> {
  return withTenant(lodgeId, async (db): Promise<SettleBankPixResult> => {
    if (status.state !== 'paid') return { ok: false, status: 400, error: 'A cobrança não está paga no banco.' };

    const invoice = await db.invoice.findFirst({ where: { id: invoiceId, lodgeId } });
    if (!invoice) return { ok: false, status: 404, error: 'Cobrança não encontrada.' };

    const referencia = status.endToEndId ?? invoice.chargeExternalId ?? invoice.id;
    await lockKey(db, `bank-pix:${referencia}`);

    // Já lançado? (cron repetido, ou baixa manual feita antes)
    const existente = await db.payment.findFirst({ where: { lodgeId, note: { contains: referencia } }, select: { id: true } });
    if (existente) return { ok: true, paymentId: existente.id, alreadySettled: true };

    const [account, integracao] = await Promise.all([
      db.account.findFirst({ where: { id: invoice.accountId, lodgeId } }),
      db.bankIntegration.findFirst({ where: { lodgeId, provider: providerId }, select: { settlementAccountId: true } }),
    ]);

    // O dinheiro caiu na conta da loja cadastrada para a cobrança pelo banco; sem ela, usa a do lançamento.
    const bankAccountId = integracao?.settlementAccountId ?? account?.bankAccountId ?? null;
    if (!bankAccountId) {
      return { ok: false, status: 409, error: 'Escolha a conta corrente que recebe as cobranças em Configurações → Integrações (Cobrança pelo banco).' };
    }

    const valor = status.value != null && status.value > 0 ? status.value : Number(invoice.amount);
    const paidAt = status.paidAt ? dateOnlyUTC(status.paidAt) : todayBR();

    const payment = await db.payment.create({
      data: {
        lodgeId,
        accountId: invoice.accountId,
        memberId: invoice.memberId,
        bankAccountId,
        amount: valor,
        method: 'pix',
        settlementType: 'bank_auto',
        paidAt,
        note: `Pix recebido no banco (${referencia})`,
      },
      select: { id: true },
    });

    await db.invoice.update({
      where: { id: invoice.id },
      data: { chargeProvider: providerId, chargeExternalId: invoice.chargeExternalId ?? null, status: 'paid' },
    });

    // Conta de um irmão: fica paga quando o total lançado cobre o valor; as cobranças dela acompanham.
    if (account?.memberId) {
      const soma = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId: account.id } });
      const pago = coversAmount(Number(soma._sum.amount ?? 0), Number(account.amount));
      await db.account.update({ where: { id: account.id }, data: { status: pago ? 'paid' : 'pending' } });
      if (pago) await db.invoice.updateMany({ where: { accountId: account.id, status: { not: 'paid' } }, data: { status: 'paid' } });
      await syncMemberBlock(db, lodgeId, account.memberId);
    }

    await logAudit(db, {
      lodgeId,
      userId,
      action: 'CREATE',
      entity: 'payment',
      entityId: payment.id,
      metadata: { origem: 'pix-banco', provedor: providerId, referencia, valor, paidAt: paidAt.toISOString().slice(0, 10) },
    });

    return { ok: true, paymentId: payment.id, alreadySettled: false };
  });
}
