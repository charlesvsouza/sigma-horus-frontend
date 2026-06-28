import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';

// Segurança do self-service: cancela no Stripe os trials de cadastro que nunca
// viraram loja (visitante pôs o cartão mas abandonou o onboarding), evitando
// cobrança órfã ao fim do trial. Identifica por metadata.selfSignup sem lodgeId,
// criados há mais de ABANDON_HOURS.
// Acionado pelo Vercel Cron (GET, header Authorization: Bearer $CRON_SECRET) ou
// manualmente (POST/GET com ?token= ou Bearer = PLATFORM_OWNER_TOKEN).
const ABANDON_HOURS = 48;

function authorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const qs = new URL(request.url).searchParams.get('token') ?? '';
  const accepted = [process.env.CRON_SECRET, process.env.PLATFORM_OWNER_TOKEN].filter(Boolean) as string[];
  return accepted.some((t) => t === bearer || t === qs);
}

async function run() {
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

  return { ok: true, checked, canceled };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}
