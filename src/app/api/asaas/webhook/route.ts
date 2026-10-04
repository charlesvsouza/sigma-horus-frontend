import { isWebhookAuthorized, processWebhook, type AsaasWebhookEvent } from '@/lib/asaas';
import { isDegreeFeeCardRef } from '@/lib/degree-fee';
import { isGroupRef } from '@/lib/asaas-group';
import { settleAsaasGroupPayment } from '@/lib/asaas-group-server';
import { prismaAdmin } from '@/lib/prisma';
import { syncMemberBlock } from '@/lib/member-block-sync';
import { settleAsaasInvoicePayment } from '@/lib/asaas-settlement';
import { MONEY_BACK_EVENTS, reverseAsaasPayment, type ReversalResult } from '@/lib/asaas-reversal';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { brl } from '@/lib/currency';
import { logAudit } from '@/lib/audit';
import { ingestQrPayment } from '@/lib/tronco-qr-server';
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

/**
 * Cobrança marcada como "Recebida em dinheiro" no painel do Asaas: o sistema lançou a baixa no Caixa e a
 * Tesouraria precisa confirmar. Avisa o Tesoureiro e os administradores por e-mail.
 */
async function notifyCashReceived(lodgeId: string, lodgeName: string, payment: { id: string; value: number }, numbers: string[]) {
  const staff = await prismaAdmin.user.findMany({ where: { lodgeId, role: { in: ['treasurer', 'admin'] }, status: 'active' }, select: { email: true } });
  for (const u of staff) {
    dispatch(
      'email',
      u.email,
      `Recebido em dinheiro no Asaas — confirme na Tesouraria — ${lodgeName}`,
      `Foi marcado como "recebido em dinheiro" no painel do Asaas um valor de ${brl(payment.value)} (cobrança ${numbers.join(', ')}; id ${payment.id}).

O sistema lançou a baixa no Caixa da loja. Abra Tesouraria → Pagamentos, confira o dinheiro e confirme a baixa (ou troque a conta, se ele foi depositado em outro lugar).`,
      EMPTY_CHANNELS,
    ).catch(() => {});
  }
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

/**
 * Devolução ao pagador (reembolso/chargeback) de um recebimento já baixado: lança o estorno (Payment negativo,
 * a conta volta a ficar em aberto) e avisa os administradores da loja — é dinheiro que SAIU da conta.
 */
async function refundAndNotify(lodgeId: string, lodgeName: string, payment: { id: string; value: number }, event: string) {
  const result: ReversalResult = await prismaAdmin.$transaction(
    (tx) => reverseAsaasPayment(tx, { lodgeId, asaasPaymentId: payment.id, event, userId: 'system:asaas-webhook' }),
    { timeout: 30_000 },
  );
  if (result.reversed === 0) return result;
  await logAudit(prismaAdmin, {
    lodgeId, userId: 'system:asaas-webhook', action: 'CREATE', entity: 'asaas-refund', entityId: payment.id,
    metadata: { event, total: result.total, invoices: result.invoiceNumbers },
  }).catch(() => {});
  const admins = await prismaAdmin.user.findMany({ where: { lodgeId, role: { in: ['admin', 'treasurer'] }, status: 'active' }, select: { email: true } });
  const motivo = event === 'PAYMENT_REFUNDED' ? 'reembolsado ao pagador' : 'contestado pelo titular do cartão (chargeback)';
  for (const a of admins) {
    dispatch(
      'email',
      a.email,
      `Atenção: recebimento estornado — ${lodgeName}`,
      `O Asaas informou que um recebimento de ${brl(result.total)} foi ${motivo} (id ${payment.id}).

O sistema lançou o estorno (saída de ${brl(result.total)} na conta de repasse) e reabriu a(s) cobrança(s): ${result.invoiceNumbers.join(', ')}. A tarifa do Asaas continua como despesa.

Confira o extrato e, se for o caso, cobre o irmão novamente.`,
      EMPTY_CHANNELS,
    ).catch(() => {});
  }
  return result;
}

/**
 * Pix agrupado (externalReference "grp:…"): várias cobranças do mesmo irmão numa cobrança do
 * Asaas. As cobranças são achadas pelo asaasPaymentId em comum; o valor e a tarifa são
 * divididos entre as abertas (lib/asaas-group). Mesmas regras do caminho individual:
 * idempotência, recebimento em duplicidade, vencido e estorno.
 */
async function handleGroupWebhook(request: Request, event: string, payment: NonNullable<AsaasWebhookEvent['payment']>) {
  const invoices = await prismaAdmin.invoice.findMany({
    where: { asaasPaymentId: payment.id },
    include: {
      lodge: { select: { asaasWebhookToken: true, name: true } },
      member: { select: { name: true, email: true } },
    },
    orderBy: { dueDate: 'asc' },
  });
  // Grupo desfeito (reemissão/renegociação soltou as cobranças): nada a fazer.
  if (invoices.length === 0) return NextResponse.json({ received: true, ignored: 'group not found' });
  const first = invoices[0];
  if (invoices.some((i) => i.lodgeId !== first.lodgeId)) return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
  if (!isWebhookAuthorized(request.headers.get('asaas-access-token'), first.lodge.asaasWebhookToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (PAID_EVENTS.has(event)) {
    const open = invoices.filter((i) => i.status !== 'paid');
    if (open.length === 0) {
      if (payment.status === 'RECEIVED_IN_CASH') return NextResponse.json({ received: true, alreadyPaid: true });
      const settled = await Promise.all(invoices.map((i) => settledByAsaasPayment(i.accountId, payment.id)));
      if (!settled.some(Boolean)) {
        await flagDuplicateReceipt(first, payment);
        return NextResponse.json({ received: true, alreadyPaid: true, duplicate: true });
      }
      return NextResponse.json({ received: true, alreadyPaid: true });
    }

    const result = await prismaAdmin.$transaction(
      (tx) => settleAsaasGroupPayment(tx, {
        lodgeId: first.lodgeId,
        asaasPaymentId: payment.id,
        total: payment.value,
        netValue: payment.netValue ?? null,
        billingType: payment.billingType ?? null,
        userId: 'system:asaas-webhook',
        source: event,
        receivedInCash: payment.status === 'RECEIVED_IN_CASH',
      }),
      { timeout: 30_000 },
    );
    if (payment.status === 'RECEIVED_IN_CASH') await notifyCashReceived(first.lodgeId, first.lodge.name, payment, open.map((i) => i.number));

    const member = open.find((i) => i.member?.email)?.member;
    if (member?.email) {
      dispatch(
        'email',
        member.email,
        `Pagamento confirmado — ${first.lodge.name}`,
        `Olá, ${member.name}.\n\nConfirmamos o recebimento do seu pagamento de ${brl(payment.value)}, que quitou ${result.settled} pendência(s): ${open.map((i) => i.number).join(', ')}.\n\nAtenciosamente,\n${first.lodge.name}`,
        EMPTY_CHANNELS,
      ).catch(() => {});
    }
    return NextResponse.json({ received: true, settled: true, group: result.settled });
  }

  if (OVERDUE_EVENTS.has(event)) {
    await prismaAdmin.invoice.updateMany({ where: { asaasPaymentId: payment.id, status: { not: 'paid' } }, data: { status: 'overdue' } });
    return NextResponse.json({ received: true, status: 'overdue', group: invoices.length });
  }

  if (MONEY_BACK_EVENTS.has(event) && (await Promise.all(invoices.map((i) => settledByAsaasPayment(i.accountId, payment.id)))).some(Boolean)) {
    const r = await refundAndNotify(first.lodgeId, first.lodge.name, payment, event);
    return NextResponse.json({ received: true, status: 'refunded', group: invoices.length, reversed: r.reversed });
  }

  if (REVERSED_EVENTS.has(event)) {
    const clear = event === 'PAYMENT_DELETED' ? { asaasPaymentId: null, asaasInvoiceUrl: null } : {};
    for (const inv of invoices) {
      // Baixada por FORA do Asaas: o cancelamento lá não desfaz o recebimento real.
      if (inv.status === 'paid' && !(await settledByAsaasPayment(inv.accountId, payment.id))) {
        if (event === 'PAYMENT_DELETED') await prismaAdmin.invoice.update({ where: { id: inv.id }, data: clear });
        continue;
      }
      await prismaAdmin.invoice.update({ where: { id: inv.id }, data: { status: 'pending', ...clear } });
    }
    for (const memberId of new Set(invoices.map((i) => i.memberId).filter((m): m is string => Boolean(m)))) {
      await syncMemberBlock(prismaAdmin, first.lodgeId, memberId);
    }
    return NextResponse.json({ received: true, status: 'reversed', group: invoices.length });
  }

  return NextResponse.json({ received: true, ignored: event });
}

/**
 * Pagamento recebido por um QR Pix estático do Tronco da sessão (`payment.pixQrCodeId`): vira uma entrada PENDENTE do Tronco,
 * ligada à sessão e à origem do QR (obreiros/visitantes); o Tesoureiro, o Venerável ou o Administrador lança no caixa. Estorno
 * de entrada ainda pendente a recusa; de entrada já lançada fica registrado na auditoria para a Tesouraria tratar.
 */
async function handleTroncoQrWebhook(
  request: Request,
  event: string,
  payment: NonNullable<ReturnType<typeof processWebhook>['payment']>,
  qr: { lodgeId: string; sessionId: string; source: string; lodge: { asaasWebhookToken: string | null } },
) {
  if (!isWebhookAuthorized(request.headers.get('asaas-access-token'), qr.lodge.asaasWebhookToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (PAID_EVENTS.has(event)) {
    const result = await prismaAdmin.$transaction((tx) => ingestQrPayment(tx, qr, { id: payment.id, status: payment.status, value: Number(payment.value), netValue: payment.netValue ?? null }));
    return NextResponse.json({ received: true, tronco: result });
  }
  if (MONEY_BACK_EVENTS.has(event) || event === 'PAYMENT_DELETED') {
    const intake = await prismaAdmin.troncoIntake.findUnique({ where: { externalRef: payment.id } });
    if (!intake) return NextResponse.json({ received: true, ignored: 'intake not found' });
    if (intake.status === 'pending') {
      await prismaAdmin.troncoIntake.update({ where: { id: intake.id }, data: { status: 'rejected', rejectReason: 'Estornado ou cancelado no Asaas', confirmedAt: new Date() } });
      return NextResponse.json({ received: true, tronco: 'rejected' });
    }
    await prismaAdmin.auditLog.create({ data: { lodgeId: intake.lodgeId, userId: null, action: 'UPDATE', entity: 'tronco-qr-refund', entityId: intake.id, after: JSON.stringify({ event, asaasPaymentId: payment.id, amount: payment.value, code: intake.code }) } });
    return NextResponse.json({ received: true, tronco: 'refund-flagged' });
  }
  return NextResponse.json({ received: true, ignored: event });
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

  // Pagamento de um QR estático do Tronco da sessão: não tem cobrança nossa; é identificado pelo `pixQrCodeId`.
  if (payment.pixQrCodeId) {
    const qr = await prismaAdmin.troncoSessionQr.findUnique({ where: { asaasQrId: payment.pixQrCodeId }, include: { lodge: { select: { asaasWebhookToken: true } } } });
    if (qr) return handleTroncoQrWebhook(request, event, payment, qr);
  }

  // Ligação com o registro local: enviamos Invoice.id como externalReference ao criar a cobrança.
  const invoiceId = payment.externalReference;
  if (isGroupRef(invoiceId)) return handleGroupWebhook(request, event, payment);

  // Parcelamento no cartão (taxa de grau): as parcelas geradas pelo Asaas vêm SEM externalReference
  // (conferido na sandbox) ou com a do parcelamento ("dfp:<plano>"), então a cota é achada pelo id
  // da parcela, gravado na emissão. Sem referência e sem cobrança nossa com esse id: não é nosso.
  // Webhook não tem sessão de tenant → prismaAdmin (bypassa RLS), escopado pelo lodgeId da própria invoice.
  const byPaymentId = !invoiceId || isDegreeFeeCardRef(invoiceId);
  const invoice = await prismaAdmin.invoice.findFirst({
    where: byPaymentId ? { asaasPaymentId: payment.id } : { id: invoiceId },
    include: {
      lodge: { select: { asaasWebhookToken: true, name: true } },
      member: { select: { name: true, email: true } },
    },
  });
  if (!invoice && !invoiceId) {
    return NextResponse.json({ received: true, ignored: 'no externalReference' });
  }
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
        netValue: payment.netValue ?? null,
        billingType: payment.billingType ?? null,
        asaasPaymentId: payment.id,
        userId: 'system:asaas-webhook',
        source: event,
        receivedInCash: payment.status === 'RECEIVED_IN_CASH',
      }),
    );
    if (payment.status === 'RECEIVED_IN_CASH') await notifyCashReceived(invoice.lodgeId, invoice.lodge.name, payment, [invoice.number]);

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

  // Eventos de uma cobrança que já foi substituída (reemissão cancela a anterior no Asaas) não
  // devem mexer na fatura: senão o PAYMENT_DELETED da antiga apagaria o vínculo da nova.
  const isCurrentCharge = !invoice.asaasPaymentId || invoice.asaasPaymentId === payment.id;

  if (OVERDUE_EVENTS.has(event)) {
    if (!isCurrentCharge) return NextResponse.json({ received: true, ignored: 'superseded charge' });
    if (invoice.status !== 'paid') {
      await prismaAdmin.invoice.update({ where: { id: invoice.id }, data: { status: 'overdue' } });
    }
    return NextResponse.json({ received: true, status: 'overdue' });
  }

  if (REVERSED_EVENTS.has(event)) {
    if (!isCurrentCharge) return NextResponse.json({ received: true, ignored: 'superseded charge' });
    // Reembolso/chargeback de dinheiro que ENTROU pelo Asaas: estorna de verdade (antes só a cobrança voltava a
    // "pendente" e o recebimento seguia lançado, deixando os livros inconsistentes).
    if (MONEY_BACK_EVENTS.has(event) && (await settledByAsaasPayment(invoice.accountId, payment.id))) {
      const r = await refundAndNotify(invoice.lodgeId, invoice.lodge.name, payment, event);
      return NextResponse.json({ received: true, status: 'refunded', reversed: r.reversed });
    }
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
      await syncMemberBlock(prismaAdmin, invoice.lodgeId, invoice.memberId);
    }
    return NextResponse.json({ received: true, status: 'reversed' });
  }

  // Evento não tratado — confirma o recebimento para o Asaas parar de reenviar.
  return NextResponse.json({ received: true, ignored: event });
}
