import { NextResponse } from 'next/server';
import { prismaAdmin } from '@/lib/prisma';
import { createInvite } from '@/lib/invites';
import { isPlanId } from '@/lib/plans';

// Endpoint do DONO DA PLATAFORMA (não é multi-tenant). Protegido por um token
// secreto enviado no header `x-platform-token` (env PLATFORM_OWNER_TOKEN).
function authorized(request: Request): boolean {
  const token = process.env.PLATFORM_OWNER_TOKEN;
  if (!token) return false;
  const header = request.headers.get('x-platform-token') ?? '';
  return header.length > 0 && header === token;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email : undefined;
  const note = typeof body?.note === 'string' ? body.note : undefined;
  const ttlDays = Number.isFinite(body?.ttlDays) ? Number(body.ttlDays) : undefined;
  const plan = typeof body?.plan === 'string' ? body.plan : undefined;
  const trialDays = Number.isFinite(body?.trialDays) ? Number(body.trialDays) : undefined;

  if (plan !== undefined && !isPlanId(plan)) {
    return NextResponse.json({ error: `Plano inválido: ${plan}` }, { status: 400 });
  }

  const invite = await createInvite({ email, note, ttlDays, plan, trialDays });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json({
    code: invite.code,
    link: `${base}/onboarding?invite=${invite.code}`,
    expiresAt: invite.expiresAt,
    plan: invite.plan,
    trialDays: invite.trialDays,
  });
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const invites = await prismaAdmin.invitation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ invites });
}
