import { prismaAdmin } from '@/lib/prisma';
import { seedLodgeDefaults } from '@/lib/seed-lodge';
import { getStripe, isPlanId } from '@/lib/stripe';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

// Recupera a Checkout Session de self-service e valida que é elegível.
async function loadSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
  if (session.mode !== 'subscription' || session.metadata?.selfSignup !== 'true' || !session.subscription) {
    return { ok: false as const, error: 'Sessão de cadastro inválida.' };
  }
  const subscription = session.subscription as Stripe.Subscription;
  return { ok: true as const, session, subscription };
}

const mapStatus = (s: string) => (s === 'active' ? 'active' : s === 'trialing' ? 'trialing' : 'inactive');
const tsToDate = (s?: number | null) => (s ? new Date(s * 1000) : null);

// GET: resumo da sessão para preencher a tela de conclusão (e-mail, plano, trial).
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id') ?? '';
  if (!sessionId) return NextResponse.json({ error: 'session_id ausente.' }, { status: 400 });

  const loaded = await loadSession(sessionId).catch(() => null);
  if (!loaded || !loaded.ok) return NextResponse.json({ error: loaded?.error ?? 'Sessão não encontrada.' }, { status: 404 });

  const { session, subscription } = loaded;
  const claimed = await prismaAdmin.subscription.findFirst({ where: { stripeSubscriptionId: subscription.id }, select: { id: true } });

  return NextResponse.json({
    email: session.customer_details?.email ?? null,
    plan: session.metadata?.plan ?? 'oficina',
    interval: session.metadata?.interval === 'year' ? 'year' : 'month',
    trialEndsAt: tsToDate(subscription.trial_end),
    alreadyUsed: Boolean(claimed),
  });
}

// POST: cria a loja + admin + assinatura ligada ao Stripe (customer/subscription reais).
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body?.sessionId ?? '');
  const name = String(body?.name ?? '').trim();
  const slug = String(body?.slug ?? '').trim().toLowerCase();
  const adminName = String(body?.adminName ?? '').trim();
  const adminEmail = String(body?.adminEmail ?? '').trim().toLowerCase();
  const adminPassword = String(body?.adminPassword ?? '');
  const riteName = String(body?.riteName ?? '').trim() || undefined;

  if (!sessionId) return NextResponse.json({ error: 'Sessão de pagamento ausente.' }, { status: 400 });
  if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 });
  }

  const loaded = await loadSession(sessionId).catch(() => null);
  if (!loaded || !loaded.ok) return NextResponse.json({ error: loaded?.error ?? 'Sessão inválida.' }, { status: 400 });
  const { session, subscription } = loaded;

  // Idempotência: a mesma assinatura não pode gerar duas lojas.
  const claimed = await prismaAdmin.subscription.findFirst({ where: { stripeSubscriptionId: subscription.id }, select: { lodgeId: true } });
  if (claimed) return NextResponse.json({ error: 'Este pagamento já criou uma loja. Faça login.' }, { status: 409 });

  const existingUser = await prismaAdmin.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 });
  const existingLodge = await prismaAdmin.lodge.findUnique({ where: { slug } });
  if (existingLodge) return NextResponse.json({ error: 'Este endereço (slug) já está em uso.' }, { status: 409 });

  const plan = isPlanId(session.metadata?.plan ?? '') ? (session.metadata!.plan as string) : 'oficina';
  const interval = session.metadata?.interval === 'year' ? 'year' : 'month';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const result = await prismaAdmin.$transaction(async (tx) => {
    const lodge = await tx.lodge.create({ data: { name, slug, status: 'active', riteName: riteName ?? null } });
    const user = await tx.user.create({
      data: { name: adminName, email: adminEmail, passwordHash, role: 'admin', lodgeId: lodge.id },
    });
    await tx.subscription.create({
      data: {
        lodgeId: lodge.id,
        plan,
        status: mapStatus(subscription.status),
        billingInterval: interval,
        paymentMethod: 'card',
        trialEndsAt: tsToDate(subscription.trial_end),
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
        stripeSubscriptionId: subscription.id,
        // current_period_* não estão no tipo Subscription deste SDK (ficam nos items).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentPeriodStart: tsToDate((subscription as any).current_period_start),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentPeriodEnd: tsToDate((subscription as any).current_period_end),
      },
    });
    await seedLodgeDefaults(tx, lodge.id, riteName);
    return { lodge, user };
  });

  // Marca a assinatura no Stripe como reivindicada (o cron ignora as com lodgeId).
  await getStripe().subscriptions.update(subscription.id, {
    metadata: { selfSignup: 'true', plan, interval, lodgeId: result.lodge.id },
  }).catch(() => {});

  return NextResponse.json({ ok: true, slug: result.lodge.slug });
}
