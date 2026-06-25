import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subscription = await withTenant(String(lodgeId), (db) =>
    db.subscription.findUnique({ where: { lodgeId: String(lodgeId) } }),
  );

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: 'Nenhuma assinatura ativa.' }, { status: 400 });
  }

  const stripeObj = getStripe();
  const portal = await stripeObj.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });

  return NextResponse.json({ url: portal.url });
}
