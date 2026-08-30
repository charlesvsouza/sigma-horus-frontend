import { isWebhookAuthorized, processWebhook } from '@/lib/asaas';
import { prismaAdmin } from '@/lib/prisma';
import { syncMemberArt002Status } from '@/lib/overdue';
import { settleAsaasInvoicePayment } from '@/lib/asaas-settlement';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
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
      const valor = Number(payment.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    await prismaAdmin.invoice.update({ where: { id: invoice.id }, data: { status: 'pending' } });
    if (invoice.memberId) {
      await syncMemberArt002Status(prismaAdmin, invoice.lodgeId, invoice.memberId);
    }
    return NextResponse.json({ received: true, status: 'reversed' });
  }

  // Evento não tratado — confirma o recebimento para o Asaas parar de reenviar.
  return NextResponse.json({ received: true, ignored: event });
}
