import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/platform-auth';

// Segurança do self-service: cancela no Stripe os trials de cadastro que nunca
// viraram loja (visitante pôs o cartão mas abandonou o onboarding), evitando
// cobrança órfã ao fim do trial. Identifica por metadata.selfSignup sem lodgeId,
// criados há mais de ABANDON_HOURS.
// Acionado pelo Vercel Cron (GET, header Authorization: Bearer $CRON_SECRET) ou
// manualmente (POST/GET com Authorization: Bearer = PLATFORM_OWNER_TOKEN).
const ABANDON_HOURS = 48;

const authorized = cronAuthorized;

async function run() {
  const stripe = getStripe();
  const cutoff = Math.floor(Date.now() / 1000) - ABANDON_HOURS * 3600;
  let canceled = 0;
  let checked = 0;
  const failures: { id: string; error: string }[] = [];

  for await (const sub of stripe.subscriptions.list({ status: 'trialing', limit: 100 })) {
    checked++;
    const meta = sub.metadata ?? {};
    if (meta.selfSignup === 'true' && !meta.lodgeId && sub.created < cutoff) {
      // Contar só o que realmente foi cancelado: trial que continua ativo vira cobrança no fim dos 10 dias.
      try {
        await stripe.subscriptions.cancel(sub.id);
        canceled++;
      } catch (error) {
        failures.push({ id: sub.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return { ok: failures.length === 0, checked, canceled, failed: failures.length, failures };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}
