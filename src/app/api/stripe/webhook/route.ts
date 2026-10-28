import { prismaAdmin } from '@/lib/prisma';
import { getStripe, isPlanId } from '@/lib/stripe';
import { NextResponse } from 'next/server';
import { markPastDue } from '@/lib/subscription-past-due-server';

function tsToDate(seconds?: number | null): Date | undefined {
  return seconds ? new Date(seconds * 1000) : undefined;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';
  const stripeObj = getStripe();

  let event;
  try {
    event = stripeObj.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? '',
    );
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = event.data.object as any;

  switch (event.type) {
    // Cartão (modo subscription): pagamento síncrono → ativa na hora.
    case 'checkout.session.completed': {
      if (obj.mode === 'subscription' && obj.subscription) {
        const lodgeId = obj.metadata?.lodgeId;
        const plan = obj.metadata?.plan ?? 'oficina';
        const interval = obj.metadata?.interval === 'year' ? 'year' : 'month';
        if (lodgeId) {
          // SDK v22 tipa current_period_* dentro de items.data[]; aqui lemos no
          // root (compat. com a forma do objeto). Tipar quebraria o build.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sub = await stripeObj.subscriptions.retrieve(obj.subscription) as any;
          await prismaAdmin.subscription.update({
            where: { lodgeId },
            data: {
              stripeSubscriptionId: obj.subscription,
              stripeCustomerId: obj.customer,
              plan,
              status: 'active',
              pastDueSince: null,
              billingInterval: interval,
              paymentMethod: 'card',
              trialEndsAt: null,
              pendingPlan: null,
              pendingPlanEffectiveAt: null,
              currentPeriodStart: tsToDate(sub.current_period_start),
              currentPeriodEnd: tsToDate(sub.current_period_end),
            },
          });
        }
      }
      // PIX/boleto (modo payment) é assíncrono: acesso só em async_payment_succeeded.
      break;
    }

    // PIX/boleto pré-pago confirmado → libera 1 ano de acesso.
    case 'checkout.session.async_payment_succeeded': {
      if (obj.mode === 'payment') {
        const lodgeId = obj.metadata?.lodgeId;
        const plan = obj.metadata?.plan ?? 'oficina';
        const method = obj.metadata?.method === 'boleto' ? 'boleto' : 'pix';
        if (lodgeId) {
          const start = new Date();
          const end = new Date(start);
          end.setFullYear(end.getFullYear() + 1);
          await prismaAdmin.subscription.update({
            where: { lodgeId },
            data: {
              stripeCustomerId: obj.customer ?? undefined,
              plan,
              status: 'active',
              pastDueSince: null,
              billingInterval: 'year',
              paymentMethod: method,
              trialEndsAt: null,
              pendingPlan: null,
              pendingPlanEffectiveAt: null,
              currentPeriodStart: start,
              currentPeriodEnd: end,
            },
          });
        }
      }
      break;
    }

    case 'checkout.session.async_payment_failed': {
      // Pagamento pré-pago não confirmado: mantém sem acesso (não altera status).
      break;
    }

    // Cobrança recorrente recusada (cartão): a loja entra em atraso, com 30 dias de tolerância antes do bloqueio
    // (lib/subscription-access.ts). A Diretoria é avisada por e-mail uma única vez por atraso.
    case 'invoice.payment_failed': {
      const subId = obj.subscription;
      if (subId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = await stripeObj.subscriptions.retrieve(subId) as any;
        const lodgeId = sub.metadata?.lodgeId;
        if (lodgeId && sub.status === 'past_due') {
          await markPastDue(lodgeId, sub.id);
        }
      }
      break;
    }

    // Renovação de assinatura recorrente (cartão).
    case 'invoice.paid': {
      const subId = obj.subscription;
      if (subId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = await stripeObj.subscriptions.retrieve(subId) as any;
        const lodgeId = sub.metadata?.lodgeId;
        // Evento fora de ordem: se a assinatura já foi cancelada/encerrada no Stripe,
        // um invoice.paid atrasado não pode reativá-la. Só renova se ainda está viva
        // e é a assinatura vigente da loja.
        if (lodgeId && (sub.status === 'active' || sub.status === 'trialing')) {
          await prismaAdmin.subscription.updateMany({
            where: {
              lodgeId,
              OR: [{ stripeSubscriptionId: sub.id }, { stripeSubscriptionId: null }],
            },
            data: {
              status: 'active',
              pastDueSince: null,
              currentPeriodStart: tsToDate(sub.current_period_start),
              currentPeriodEnd: tsToDate(sub.current_period_end),
            },
          });
        }
      }
      break;
    }

    // Mudanças de assinatura (inclui a aplicação do downgrade agendado:
    // o schedule troca o price e dispara este evento com o novo plano).
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      // Eventos podem chegar fora de ordem (ou repetidos). O payload é um retrato do
      // momento em que foi emitido; o estado vigente vem do Stripe. Reconsultamos e
      // aplicamos sempre o estado atual — assim um evento velho nunca regride a loja.
      // Erro diferente de "não existe" propaga (500) e o Stripe reentrega o evento.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let live: any = obj;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        live = (await stripeObj.subscriptions.retrieve(obj.id)) as any;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== 'resource_missing') throw err;
      }
      const customerId = live.customer ?? obj.customer;
      // Preserva o trial: Stripe trialing → nosso 'trialing' (com trialEndsAt),
      // para o painel mostrar a contagem regressiva. active → 'active'.
      const stripeStatus = live.status;
      const mappedStatus =
        stripeStatus === 'active' ? 'active' : stripeStatus === 'trialing' ? 'trialing' : stripeStatus === 'past_due' ? 'past_due' : 'inactive';
      const priceMeta = live.items?.data?.[0]?.price?.metadata;
      const newPlan = priceMeta?.plan;
      const newInterval = priceMeta?.interval === 'year' ? 'year' : priceMeta?.interval === 'month' ? 'month' : undefined;

      if (customerId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {
          status: mappedStatus,
          trialEndsAt: stripeStatus === 'trialing' ? tsToDate(live.trial_end) ?? null : null,
          // Em atraso, o início já foi marcado (markPastDue); qualquer outra situação zera a contagem.
          ...(mappedStatus === 'past_due' ? {} : { pastDueSince: null }),
          currentPeriodStart: tsToDate(live.current_period_start),
          currentPeriodEnd: tsToDate(live.current_period_end),
        };
        // Se o price carrega o plano (downgrade aplicado / mudança), sincroniza.
        if (newPlan && isPlanId(newPlan)) {
          data.plan = newPlan;
          data.pendingPlan = null;
          data.pendingPlanEffectiveAt = null;
          data.stripeScheduleId = null;
          if (newInterval) data.billingInterval = newInterval;
        }
        if (event.type === 'customer.subscription.deleted') {
          data.status = 'inactive';
        }
        // Só a assinatura vigente da loja: o cancelamento (ou atualização) de uma
        // assinatura antiga do mesmo cliente não pode derrubar a nova.
        await prismaAdmin.subscription.updateMany({
          where: {
            stripeCustomerId: customerId,
            OR: [{ stripeSubscriptionId: obj.id }, { stripeSubscriptionId: null }],
          },
          data,
        });
        // Atraso detectado só pela atualização da assinatura (sem o evento da fatura): marca o início agora.
        if (mappedStatus === 'past_due' && event.type !== 'customer.subscription.deleted') {
          const lodge = await prismaAdmin.subscription.findFirst({ where: { stripeCustomerId: customerId }, select: { lodgeId: true } });
          if (lodge) await markPastDue(lodge.lodgeId, obj.id);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
