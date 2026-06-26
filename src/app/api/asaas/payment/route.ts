import { auth } from '@/lib/auth';
import { createCustomer, createPayment } from '@/lib/asaas';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type BillingType = 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
const BILLING_TYPES: BillingType[] = ['BOLETO', 'PIX', 'CREDIT_CARD', 'UNDEFINED'];

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const invoiceId = String(body?.invoiceId ?? '').trim();
  const billingType = (BILLING_TYPES.includes(body?.billingType) ? body.billingType : 'BOLETO') as BillingType;

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId é obrigatório.' }, { status: 400 });
  }

  // 1) Lê config da loja + cobrança + membro (transação curta, sem rede).
  const ctx = await withTenant(String(lodgeId), async (db) => {
    const lodge = await db.lodge.findUnique({
      where: { id: String(lodgeId) },
      select: { asaasApiKeyEnc: true, asaasEnv: true },
    });
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, lodgeId: String(lodgeId) },
      include: { member: true },
    });
    return { lodge, invoice };
  });

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
      await db.invoice.update({ where: { id: ctx.invoice!.id }, data: { status: 'billed' } });
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
