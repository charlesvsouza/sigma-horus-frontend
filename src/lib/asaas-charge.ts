import { AGREEMENT_ITEM_MESSAGE, agreementDebtAccountIds } from '@/lib/agreement-items';
import { createCustomer, createPayment, deletePayment, getPixQrCode, type AsaasConfig } from '@/lib/asaas';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { logAudit } from '@/lib/audit';
import { isAsaasMode, normalizeBillingChoice, type AsaasBillingChoice } from '@/lib/collection';
import { todayBR } from '@/lib/date-only';
import { withTenant } from '@/lib/prisma';
import { detachGroupSiblings } from '@/lib/asaas-group-db';

// Emissão de uma cobrança (Invoice) no Asaas da loja — compartilhada pela Tesouraria
// (Cobranças → Emitir) e pelo próprio irmão (Portal → Pagar). Rede SEMPRE fora da
// transação: lê (curta) → chama o Asaas → persiste (curta).

export interface PixQr {
  /** "Pix copia e cola". */
  payload: string;
  /** PNG em base64 (sem o prefixo data:). */
  encodedImage: string;
}

export type EmitResult =
  | { ok: true; asaasPaymentId: string | null; invoiceUrl: string | null; bankSlipUrl: string | null; pix: PixQr | null; raw: unknown }
  | { ok: false; status: number; error: string };

/** Vencimento enviado ao Asaas: ele recusa data no passado, então conta vencida vai com "hoje" (Brasília). */
export function asaasDueDate(dueDate: Date, now: Date = new Date()): string {
  const today = todayBR(now);
  return (dueDate.getTime() < today.getTime() ? today : dueDate).toISOString().slice(0, 10);
}

/** QR do Pix de uma cobrança já emitida; null se o Asaas não devolver (ex.: boleto). */
export async function fetchPixQr(config: AsaasConfig, asaasPaymentId: string): Promise<PixQr | null> {
  try {
    const qr = await getPixQrCode(config, asaasPaymentId);
    return qr?.payload ? { payload: qr.payload, encodedImage: qr.encodedImage } : null;
  } catch {
    return null;
  }
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

  const config = buildLodgeAsaasConfig(ctx.lodge);
  if (!config) return { ok: false, status: 409, error: 'Asaas não conectado para esta loja. Configure em Integrações.' };
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

  // 2) Chamadas de rede ao Asaas (FORA da transação).
  let customerId = member.asaasCustomerId;
  let createdCustomer = false;
  try {
    if (!customerId) {
      const customer = await createCustomer(config, {
        name: member.name,
        email: member.email ?? undefined,
        cpfCnpj: member.cpf,
        phone: member.phone ?? undefined,
      });
      customerId = customer?.id ?? null;
      createdCustomer = true;
    }
    if (!customerId) return { ok: false, status: 502, error: 'Falha ao criar/obter o cliente no Asaas.' };

    // Reemissão: a cobrança anterior ainda existe no Asaas e poderia ser paga em duplicidade — cancela antes.
    if (invoice.asaasPaymentId && invoice.status !== 'paid') {
      try {
        await deletePayment(config, invoice.asaasPaymentId);
      } catch (error) {
        // Cobrança que já não existe no Asaas não impede a reemissão; qualquer outra falha sim —
        // seguir deixaria duas cobranças abertas para o mesmo irmão (pagamento em duplicidade).
        const message = error instanceof Error ? error.message : String(error);
        if (!/404|not.?found|n[ãa]o.?encontr/i.test(message)) {
          return { ok: false, status: 502, error: `Não foi possível cancelar a cobrança anterior no Asaas: ${message}. Tente de novo.` };
        }
      }
    }

    const payment = await createPayment(config, {
      customer: customerId,
      billingType,
      value,
      dueDate: asaasDueDate(invoice.dueDate),
      description: invoice.description ?? `Cobrança ${invoice.number}`,
      externalReference: invoice.id,
    });
    const asaasPaymentId: string | null = payment?.id ?? null;
    const invoiceUrl: string | null = payment?.invoiceUrl ?? null;
    const bankSlipUrl: string | null = payment?.bankSlipUrl ?? null;

    // 3) Persiste o customerId novo + marca a cobrança como emitida (transação curta).
    await withTenant(lodgeId, async (db) => {
      if (createdCustomer && customerId) {
        await db.member.update({ where: { id: member.id }, data: { asaasCustomerId: customerId } });
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

    const pix = billingType === 'PIX' && asaasPaymentId ? await fetchPixQr(config, asaasPaymentId) : null;
    return { ok: true, asaasPaymentId, invoiceUrl, bankSlipUrl, pix, raw: payment };
  } catch (err) {
    return { ok: false, status: 502, error: err instanceof Error ? err.message : 'Erro ao emitir cobrança no Asaas.' };
  }
}
