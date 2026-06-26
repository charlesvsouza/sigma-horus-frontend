import { prismaAdmin } from '@/lib/prisma';
import { getStripe, isPlanId } from '@/lib/stripe';
import { NextResponse } from 'next/server';

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
          const sub = await stripeObj.subscriptions.retrieve(obj.subscription) as any;
          await prismaAdmin.subscription.update({
            where: { lodgeId },
            data: {
              stripeSubscriptionId: obj.subscription,
              stripeCustomerId: obj.customer,
              plan,
              status: 'active',
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

    // Renovação de assinatura recorrente (cartão).
    case 'invoice.paid': {
      const subId = obj.subscription;
      if (subId) {
        const sub = await stripeObj.subscriptions.retrieve(subId) as any;
        const lodgeId = sub.metadata?.lodgeId;
        if (lodgeId) {
          await prismaAdmin.subscription.update({
            where: { lodgeId },
            data: {
              status: 'active',
              currentPeriodStart: tsToDate(sub.current_period_start),
              currentPeriodEnd: tsToDate(sub.current_period_end),
            },
          }).catch(() => {});
        }
      }
      break;
    }

    // Mudanças de assinatura (inclui a aplicação do downgrade agendado:
    // o schedule troca o price e dispara este evento com o novo plano).
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const customerId = obj.customer;
      const isActive = obj.status === 'active' || obj.status === 'trialing';
      const priceMeta = obj.items?.data?.[0]?.price?.metadata;
      const newPlan = priceMeta?.plan;
      const newInterval = priceMeta?.interval === 'year' ? 'year' : priceMeta?.interval === 'month' ? 'month' : undefined;

      if (customerId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {
          status: isActive ? 'active' : 'inactive',
          currentPeriodStart: tsToDate(obj.current_period_start),
          currentPeriodEnd: tsToDate(obj.current_period_end),
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
        await prismaAdmin.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data,
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
