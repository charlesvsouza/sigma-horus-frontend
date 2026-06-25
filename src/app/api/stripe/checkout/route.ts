import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { getStripe, PLANS, type PlanId } from '@/lib/stripe';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const planId = String(body?.plan ?? 'oficina') as PlanId;

  if (!PLANS[planId]) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  }

  const plan = PLANS[planId];

  // Short tenant transaction: load lodge + ensure a subscription row exists.
  const data = await withTenant(String(lodgeId), async (db) => {
    const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) } });
    if (!lodge) return { notFound: true as const };

    let subscription = await db.subscription.findUnique({ where: { lodgeId: String(lodgeId) } });
    if (!subscription) {
      subscription = await db.subscription.create({
        data: { lodgeId: String(lodgeId), plan: planId, status: 'inactive' },
      });
    }
    return { lodge, subscription };
  });

  if ('notFound' in data) {
    return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
  }

  const { lodge, subscription } = data;
  const stripeObj = getStripe();

  // External call outside any DB transaction.
  const stripeCustomerId = subscription.stripeCustomerId
    ?? (await stripeObj.customers.create({
      name: lodge.name,
      metadata: { lodgeId: String(lodgeId) },
    })).id;

  if (!subscription.stripeCustomerId) {
    await withTenant(String(lodgeId), (db) =>
      db.subscription.update({
        where: { id: subscription.id },
        data: { stripeCustomerId },
      }),
    );
  }

  const checkout = await stripeObj.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: {
          name: plan.name,
          description: plan.description,
        },
        unit_amount: plan.price,
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    metadata: { lodgeId: String(lodgeId), plan: planId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/#planos`,
  });

  return NextResponse.json({ url: checkout.url });
}
