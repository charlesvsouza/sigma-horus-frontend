import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';

// Segurança do self-service: cancela no Stripe os trials de cadastro que nunca
// viraram loja (visitante pôs o cartão mas abandonou o onboarding), evitando
// cobrança órfã ao fim do trial. Identifica por metadata.selfSignup sem lodgeId,
// criados há mais de ABANDON_HOURS. Protegido por PLATFORM_OWNER_TOKEN.
const ABANDON_HOURS = 48;

function authorized(request: Request): boolean {
  const token = process.env.PLATFORM_OWNER_TOKEN;
  if (!token) return false;
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const qs = new URL(request.url).searchParams.get('token') ?? '';
  return bearer === token || qs === token;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stripe = getStripe();
  const cutoff = Math.floor(Date.now() / 1000) - ABANDON_HOURS * 3600;
  let canceled = 0;
  let checked = 0;

  for await (const sub of stripe.subscriptions.list({ status: 'trialing', limit: 100 })) {
    checked++;
    const meta = sub.metadata ?? {};
    if (meta.selfSignup === 'true' && !meta.lodgeId && sub.created < cutoff) {
      await stripe.subscriptions.cancel(sub.id).catch(() => {});
      canceled++;
    }
  }

  return NextResponse.json({ ok: true, checked, canceled });
}
