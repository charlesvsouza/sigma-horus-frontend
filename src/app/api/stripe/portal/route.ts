import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';
import { canManageSubscription } from '@/lib/rbac';

export async function POST() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Cobrança da assinatura da loja: só o Administrador (a tela Assinatura já é só dele).
  if (!canManageSubscription(session?.user?.role)) {
    return NextResponse.json({ error: 'Apenas o Administrador, o Venerável e o Tesoureiro gerenciam a assinatura da loja.' }, { status: 403 });
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
