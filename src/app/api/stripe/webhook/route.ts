import { prismaAdmin } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';

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

  const session = event.data.object as any;

  switch (event.type) {
    case 'checkout.session.completed': {
      const lodgeId = session.metadata?.lodgeId;
      const plan = session.metadata?.plan ?? 'oficina';
      const stripeSubscriptionId = session.subscription;

      if (lodgeId && stripeSubscriptionId) {
        await prismaAdmin.subscription.upsert({
          where: { lodgeId },
          update: {
            stripeSubscriptionId,
            stripeCustomerId: session.customer,
            plan,
            status: 'active',
            currentPeriodStart: new Date(session.created * 1000),
            currentPeriodEnd: new Date(session.expires_at ? session.expires_at * 1000 : Date.now()),
          },
          create: {
            lodgeId,
            stripeSubscriptionId,
            stripeCustomerId: session.customer,
            plan,
            status: 'active',
          },
        });
      }
      break;
    }

    case 'invoice.paid': {
      const subId = session.subscription;
      if (subId) {
        const sub = await stripeObj.subscriptions.retrieve(subId) as any;
        const lodgeId = sub.metadata?.lodgeId;
        if (lodgeId) {
          await prismaAdmin.subscription.update({
            where: { lodgeId },
            data: {
              status: 'active',
              currentPeriodStart: new Date(sub.current_period_start * 1000),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
          });
        }
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subEvent = event.data.object as any;
      const customerId = subEvent.customer;
      const isActive = subEvent.status === 'active' || subEvent.status === 'trialing';

      if (customerId) {
        await prismaAdmin.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            status: isActive ? 'active' : 'inactive',
            currentPeriodStart: new Date(subEvent.current_period_start * 1000),
            currentPeriodEnd: new Date(subEvent.current_period_end * 1000),
          },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
