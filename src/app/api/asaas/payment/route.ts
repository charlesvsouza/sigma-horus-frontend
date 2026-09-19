import { auth } from '@/lib/auth';
import { createCustomer, createPayment, deletePayment } from '@/lib/asaas';
import { isAsaasMode, normalizeBillingChoice } from '@/lib/collection';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const invoiceId = String(body?.invoiceId ?? '').trim();

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId é obrigatório.' }, { status: 400 });
  }

  // 1) Lê config da loja + cobrança + membro (transação curta, sem rede).
  const ctx = await withTenant(String(lodgeId), async (db) => {
    const lodge = await db.lodge.findUnique({
      where: { id: String(lodgeId) },
      select: { asaasApiKeyEnc: true, asaasEnv: true, collectionMode: true, asaasSettlementAccountId: true, asaasBillingType: true },
    });
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, lodgeId: String(lodgeId) },
      include: { member: true },
    });
    return { lodge, invoice };
  });

  // Modo de recebimento é escolha da loja: fora do Modo Asaas não se emite no Asaas.
  if (!isAsaasMode(ctx.lodge)) {
    return NextResponse.json({ error: 'Esta loja recebe no Modo Loja (direto na conta da loja). Para emitir no Asaas, mude o modo em Configurações da loja → Recebimento das cobranças.' }, { status: 409 });
  }
  // Todo recebimento cai na conta corrente da loja: sem a conta de repasse, o dinheiro do Asaas ficaria sem destino.
  if (!ctx.lodge?.asaasSettlementAccountId) {
    return NextResponse.json({ error: 'Escolha a conta corrente que recebe o repasse do Asaas em Configurações da loja → Recebimento das cobranças.' }, { status: 409 });
  }
  // Cartão fica fora: a emissão é sempre explícita em Pix ou boleto (o padrão vem da loja).
  const billingType = normalizeBillingChoice(body?.billingType, normalizeBillingChoice(ctx.lodge.asaasBillingType));

  const config = buildLodgeAsaasConfig(ctx.lodge);
  if (!config) {
    return NextResponse.json({ error: 'Asaas não conectado para esta loja. Configure em Integrações.' }, { status: 409 });
  }
  if (!ctx.invoice) {
    return NextResponse.json({ error: 'Cobrança não encontrada.' }, { status: 404 });
  }

  const member = ctx.invoice.member;
  if (!member) {
    return NextResponse.json({ error: 'A cobrança precisa estar vinculada a um membro.' }, { status: 400 });
  }
  if (!member.cpf) {
    return NextResponse.json({ error: 'O membro precisa ter CPF/CNPJ cadastrado para emitir no Asaas.' }, { status: 400 });
  }

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

    if (!customerId) {
      return NextResponse.json({ error: 'Falha ao criar/obter o cliente no Asaas.' }, { status: 502 });
    }

    // Reemissão: a cobrança anterior ainda existe no Asaas e poderia ser paga em duplicidade — cancela antes.
    if (ctx.invoice.asaasPaymentId && ctx.invoice.status !== 'paid') {
      await deletePayment(config, ctx.invoice.asaasPaymentId).catch(() => {});
    }

    const payment = await createPayment(config, {
      customer: customerId,
      billingType,
      value: Number(ctx.invoice.amount),
      dueDate: ctx.invoice.dueDate.toISOString().slice(0, 10),
      description: ctx.invoice.description ?? `Cobrança ${ctx.invoice.number}`,
      externalReference: ctx.invoice.id,
    });

    // 3) Persiste o customerId novo + marca a cobrança como emitida (transação curta).
    await withTenant(String(lodgeId), async (db) => {
      if (createdCustomer && customerId) {
        await db.member.update({ where: { id: member.id }, data: { asaasCustomerId: customerId } });
      }
      await db.invoice.update({
        where: { id: ctx.invoice!.id },
        data: {
          status: 'billed',
          asaasPaymentId: payment?.id ?? null,
          asaasInvoiceUrl: payment?.invoiceUrl ?? payment?.bankSlipUrl ?? null,
        },
      });
      await logAudit(db, {
        lodgeId: String(lodgeId),
        userId: session.user.id,
        action: 'UPDATE',
        entity: 'invoice',
        entityId: ctx.invoice!.id,
        metadata: { action: 'asaas_charge', billingType, asaasPaymentId: payment?.id, value: ctx.invoice!.amount },
      });
    });

    return NextResponse.json({
      item: payment,
      bankSlipUrl: payment?.bankSlipUrl ?? null,
      invoiceUrl: payment?.invoiceUrl ?? null,
      pixCopyPaste: payment?.pixCopiaECola ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao emitir cobrança no Asaas.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
