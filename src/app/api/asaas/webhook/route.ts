import { isWebhookAuthorized, processWebhook } from '@/lib/asaas';
import { prismaAdmin } from '@/lib/prisma';
import { syncMemberArt002Status } from '@/lib/overdue';
import { settleAsaasInvoicePayment } from '@/lib/asaas-settlement';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { brl } from '@/lib/currency';
import { logAudit } from '@/lib/audit';
import { NextResponse } from 'next/server';

// Eventos do Asaas que significam "dinheiro recebido" → baixa automática.
const PAID_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
// Vencido sem pagamento.
const OVERDUE_EVENTS = new Set(['PAYMENT_OVERDUE']);
// Estorno/cancelamento → volta a cobrança para pendente.
const REVERSED_EVENTS = new Set([
  'PAYMENT_REFUNDED',
  'PAYMENT_DELETED',
  'PAYMENT_REVERSED',
  'PAYMENT_CHARGEBACK_REQUESTED',
]);

// A baixa automática grava o id do Asaas na nota do Payment (asaas-settlement.ts).
async function settledByAsaasPayment(accountId: string, asaasPaymentId: string) {
  const found = await prismaAdmin.payment.findFirst({ where: { accountId, note: { contains: asaasPaymentId } }, select: { id: true } });
  return Boolean(found);
}

async function flagDuplicateReceipt(
  invoice: { id: string; lodgeId: string; number: string; lodge: { name: string } },
  payment: { id: string; value: number },
) {
  await logAudit(prismaAdmin, {
    lodgeId: invoice.lodgeId,
    userId: 'system:asaas-webhook',
    action: 'CREATE',
    entity: 'asaas-duplicate-receipt',
    entityId: invoice.id,
    metadata: { number: invoice.number, asaasPaymentId: payment.id, value: payment.value },
  }).catch(() => {});

  const admins = await prismaAdmin.user.findMany({ where: { lodgeId: invoice.lodgeId, role: 'admin', status: 'active' }, select: { email: true } });
  const valor = brl(payment.value);
  for (const a of admins) {
    dispatch(
      'email',
      a.email,
      `Atenção: recebimento em duplicidade — ${invoice.lodge.name}`,
      `A cobrança ${invoice.number} já estava baixada manualmente, mas o Asaas confirmou agora um pagamento de ${valor} (id ${payment.id}).

O valor entrou na conta do Asaas e NÃO foi lançado no sistema. Verifique e, se for o caso, faça o estorno ao membro pelo painel do Asaas.`,
      EMPTY_CHANNELS,
    ).catch(() => {});
  }
}

export async function POST(request: Request) {
  let payload;
  try {
    payload = processWebhook(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { event, payment } = payload;
  if (!event || !payment) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Ligação com o registro local: enviamos Invoice.id como externalReference ao criar a cobrança.
  const invoiceId = payment.externalReference;
  if (!invoiceId) {
    return NextResponse.json({ received: true, ignored: 'no externalReference' });
  }

  // Webhook não tem sessão de tenant → prismaAdmin (bypassa RLS), escopado pelo lodgeId da própria invoice.
  const invoice = await prismaAdmin.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lodge: { select: { asaasWebhookToken: true, name: true } },
      member: { select: { name: true, email: true } },
    },
  });
  if (!invoice) {
    return NextResponse.json({ received: true, ignored: 'invoice not found' });
  }

  // Autentica o webhook contra o token da loja dona da cobrança (BYO-key).
  if (!isWebhookAuthorized(request.headers.get('asaas-access-token'), invoice.lodge.asaasWebhookToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (PAID_EVENTS.has(event)) {
    // Idempotência: Asaas reenvia webhooks. Se já está paga, não duplica a baixa.
    if (invoice.status === 'paid') {
      // RECEIVED_IN_CASH é o eco do nosso próprio "recebido fora do Asaas" — nada a fazer.
      if (payment.status === 'RECEIVED_IN_CASH') {
        return NextResponse.json({ received: true, alreadyPaid: true });
      }
      // Dinheiro REAL chegou pelo Asaas, mas a cobrança já estava baixada sem esse
      // pagamento (baixa manual anterior): recebimento em duplicidade. Não some em
      // silêncio — registra na auditoria e avisa os administradores da loja.
      if (!(await settledByAsaasPayment(invoice.accountId, payment.id))) {
        await flagDuplicateReceipt(invoice, payment);
        return NextResponse.json({ received: true, alreadyPaid: true, duplicate: true });
      }
      return NextResponse.json({ received: true, alreadyPaid: true });
    }

    await prismaAdmin.$transaction((tx) =>
      settleAsaasInvoicePayment(tx, {
        lodgeId: invoice.lodgeId,
        invoiceId: invoice.id,
        accountId: invoice.accountId,
        memberId: invoice.memberId,
        amount: payment.value,
        asaasPaymentId: payment.id,
        userId: 'system:asaas-webhook',
        source: event,
      }),
    );

    if (invoice.member?.email) {
      const valor = brl(payment.value);
      dispatch(
        'email',
        invoice.member.email,
        `Pagamento confirmado — ${invoice.lodge.name}`,
        `Olá, ${invoice.member.name}.\n\nConfirmamos o recebimento do seu pagamento de ${valor} referente à cobrança ${invoice.number}.\n\nAtenciosamente,\n${invoice.lodge.name}`,
        EMPTY_CHANNELS,
      ).catch(() => {});
    }

    return NextResponse.json({ received: true, settled: true });
  }

  if (OVERDUE_EVENTS.has(event)) {
    if (invoice.status !== 'paid') {
      await prismaAdmin.invoice.update({ where: { id: invoice.id }, data: { status: 'overdue' } });
    }
    return NextResponse.json({ received: true, status: 'overdue' });
  }

  if (REVERSED_EVENTS.has(event)) {
    // Cobrança cancelada/estornada no Asaas. Se ela já estava baixada por FORA do
    // Asaas (recebimento manual), o cancelamento lá não desfaz o recebimento real —
    // só limpa o vínculo com a cobrança do Asaas.
    if (invoice.status === 'paid' && !(await settledByAsaasPayment(invoice.accountId, payment.id))) {
      if (event === 'PAYMENT_DELETED') {
        await prismaAdmin.invoice.update({ where: { id: invoice.id }, data: { asaasPaymentId: null, asaasInvoiceUrl: null } });
      }
      return NextResponse.json({ received: true, status: 'kept-paid' });
    }
    await prismaAdmin.invoice.update({
      where: { id: invoice.id },
      data: { status: 'pending', ...(event === 'PAYMENT_DELETED' ? { asaasPaymentId: null, asaasInvoiceUrl: null } : {}) },
    });
    if (invoice.memberId) {
      await syncMemberArt002Status(prismaAdmin, invoice.lodgeId, invoice.memberId);
    }
    return NextResponse.json({ received: true, status: 'reversed' });
  }

  // Evento não tratado — confirma o recebimento para o Asaas parar de reenviar.
  return NextResponse.json({ received: true, ignored: event });
}
