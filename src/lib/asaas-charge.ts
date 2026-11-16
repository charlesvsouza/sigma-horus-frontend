import { AGREEMENT_ITEM_MESSAGE, agreementDebtAccountIds } from '@/lib/agreement-items';
import { type AsaasConfig } from '@/lib/asaas';
import { asaasDueDate } from '@/lib/asaas-due-date';
import { logAudit } from '@/lib/audit';
import { BillingProviderError, type PixQr } from '@/lib/billing-provider';
import { createAsaasProvider } from '@/lib/billing-provider-asaas';
import { resolveBillingProvider } from '@/lib/billing-provider-registry';
import { isAsaasMode, normalizeBillingChoice, type AsaasBillingChoice } from '@/lib/collection';
import { withTenant } from '@/lib/prisma';
import { detachGroupSiblings } from '@/lib/asaas-group-db';

// Emissão de uma cobrança (Invoice) no provedor da loja (hoje o Asaas) — compartilhada pela Tesouraria
// (Cobranças → Emitir) e pelo próprio irmão (Portal → Pagar). Rede SEMPRE fora da
// transação: lê (curta) → chama o provedor → persiste (curta).
// O que é específico do provedor (cliente, cancelamento, chamadas) fica em `billing-provider-asaas.ts`.

export type { PixQr };
export { asaasDueDate };

export type EmitResult =
  | { ok: true; asaasPaymentId: string | null; invoiceUrl: string | null; bankSlipUrl: string | null; pix: PixQr | null; raw: unknown }
  | { ok: false; status: number; error: string; /** Código do erro do Asaas (ex.: invalid_billingType = Pix não liberado na conta). */ code?: string | null };

/** QR do Pix de uma cobrança já emitida; null se o Asaas não devolver (ex.: boleto). */
export async function fetchPixQr(config: AsaasConfig, asaasPaymentId: string): Promise<PixQr | null> {
  return createAsaasProvider(config).fetchPixQr(asaasPaymentId);
}

export async function emitInvoiceCharge(params: {
  lodgeId: string;
  invoiceId: string;
  actorId: string;
  /** Pix ou boleto; na falta, o padrão da loja. */
  billingType?: unknown;
  /** Valor a cobrar; na falta, o da cobrança (o portal manda o saldo em aberto, descontados pagamentos parciais). */
  value?: number;
  /** Mensagem de CPF ausente (o portal pede para o irmão completar "Meus dados"). */
  missingCpfError?: string;
}): Promise<EmitResult> {
  const { lodgeId, invoiceId, actorId } = params;

  // 1) Lê config da loja + cobrança + membro (transação curta, sem rede).
  const ctx = await withTenant(lodgeId, async (db) => {
    const lodge = await db.lodge.findUnique({
      where: { id: lodgeId },
      select: { asaasApiKeyEnc: true, asaasEnv: true, collectionMode: true, asaasSettlementAccountId: true, asaasBillingType: true },
    });
    const invoice = await db.invoice.findFirst({ where: { id: invoiceId, lodgeId }, include: { member: true, account: { select: { degreeFeePlan: { select: { paymentMethod: true } } } } } });
    const inAgreement = invoice ? (await agreementDebtAccountIds(db, lodgeId)).has(invoice.accountId) : false;
    return { lodge, invoice, inAgreement };
  });

  // Modo de recebimento é escolha da loja: fora do Modo Asaas não se emite no Asaas.
  if (!isAsaasMode(ctx.lodge)) {
    return { ok: false, status: 409, error: 'Esta loja recebe no Modo Loja (direto na conta da loja). Para emitir no Asaas, mude o modo em Configurações da loja → Recebimento das cobranças.' };
  }
  // Todo recebimento cai na conta corrente da loja: sem a conta de repasse, o dinheiro do Asaas ficaria sem destino.
  if (!ctx.lodge?.asaasSettlementAccountId) {
    return { ok: false, status: 409, error: 'Escolha a conta corrente que recebe o repasse do Asaas em Configurações da loja → Recebimento das cobranças.' };
  }
  // Cartão fica fora: a emissão é sempre explícita em Pix ou boleto (o padrão vem da loja).
  const billingType: AsaasBillingChoice = normalizeBillingChoice(params.billingType, normalizeBillingChoice(ctx.lodge.asaasBillingType));

  const provider = resolveBillingProvider(ctx.lodge);
  if (!provider) return { ok: false, status: 409, error: 'Asaas não conectado para esta loja. Configure em Integrações.' };
  const invoice = ctx.invoice;
  if (!invoice) return { ok: false, status: 404, error: 'Cobrança não encontrada.' };
  // Cota de taxa de grau no cartão é parcela de um parcelamento do Asaas: reemitir em Pix/boleto
  // cancelaria a parcela e desmancharia o parcelamento. O pagamento é pelo link do cartão.
  if (invoice.account?.degreeFeePlan?.paymentMethod === 'card') {
    return { ok: false, status: 409, error: 'Esta cota é de um parcelamento no cartão de crédito: o irmão paga pelo link do cartão (Taxas de grau).' };
  }
  if (ctx.inAgreement) return { ok: false, status: 409, error: AGREEMENT_ITEM_MESSAGE };
  const member = invoice.member;
  if (!member) return { ok: false, status: 400, error: 'A cobrança precisa estar vinculada a um membro.' };
  if (!member.cpf) return { ok: false, status: 400, error: params.missingCpfError ?? 'O membro precisa ter CPF/CNPJ cadastrado para emitir no Asaas.' };

  const value = params.value ?? Number(invoice.amount);

  // 2) Chamadas de rede ao provedor (FORA da transação).
  try {
    const emitted = await provider.emit({
      invoice: { id: invoice.id, number: invoice.number, description: invoice.description, dueDate: invoice.dueDate },
      member: { id: member.id, name: member.name, email: member.email, phone: member.phone, cpf: member.cpf, providerCustomerId: member.asaasCustomerId },
      value,
      method: billingType,
      replaceExternalId: invoice.asaasPaymentId && invoice.status !== 'paid' ? invoice.asaasPaymentId : null,
    });
    const asaasPaymentId = emitted.externalId;
    const { invoiceUrl, bankSlipUrl } = emitted;

    // 3) Persiste o customerId novo + marca a cobrança como emitida (transação curta).
    await withTenant(lodgeId, async (db) => {
      if (emitted.newProviderCustomerId) {
        await db.member.update({ where: { id: member.id }, data: { asaasCustomerId: emitted.newProviderCustomerId } });
      }
      // A cobrança anterior (apagada acima) pode ter sido um Pix agrupado: as outras contas dele
      // perdem o Pix e voltam a pendente, para gerar um novo.
      if (invoice.asaasPaymentId && invoice.status !== 'paid') {
        await detachGroupSiblings(db, lodgeId, [invoice.asaasPaymentId], [invoice.id]);
      }
      await db.invoice.update({
        where: { id: invoice.id },
        data: { status: 'billed', asaasPaymentId, asaasInvoiceUrl: invoiceUrl ?? bankSlipUrl },
      });
      await logAudit(db, {
        lodgeId,
        userId: actorId,
        action: 'UPDATE',
        entity: 'invoice',
        entityId: invoice.id,
        metadata: { action: 'asaas_charge', billingType, asaasPaymentId, value },
      });
    });

    const pix = billingType === 'PIX' && asaasPaymentId ? await provider.fetchPixQr(asaasPaymentId) : null;
    return { ok: true, asaasPaymentId, invoiceUrl, bankSlipUrl, pix, raw: emitted.raw };
  } catch (err) {
    if (err instanceof BillingProviderError) return { ok: false, status: err.status, error: err.message, code: err.code };
    return { ok: false, status: 502, error: err instanceof Error ? err.message : `Erro ao emitir cobrança no ${provider.label}.`, code: null };
  }
}
