import { prismaAdmin } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { platformAuthorized } from '@/lib/platform-auth';
import { subscriptionAccess } from '@/lib/subscription-access';

// Visão global do dono da plataforma: TODAS as lojas (de qualquer situação), com assinatura e tamanho.
// Mesmo token de /plataforma/* (x-platform-token). Só leitura; entrar numa loja é pelo login "platform-impersonate".
export async function GET(request: Request) {
  if (!platformAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [lodges, subs, members, users] = await Promise.all([
    prismaAdmin.lodge.findMany({
      select: { id: true, name: true, slug: true, status: true, city: true, state: true, acquisitionSource: true, createdAt: true },
      orderBy: { name: 'asc' },
    }),
    prismaAdmin.subscription.findMany({
      select: { lodgeId: true, plan: true, status: true, trialEndsAt: true, currentPeriodEnd: true, billingInterval: true, paymentMethod: true },
    }),
    prismaAdmin.member.groupBy({ by: ['lodgeId'], where: { status: 'active' }, _count: { _all: true } }),
    prismaAdmin.user.groupBy({ by: ['lodgeId'], where: { status: 'active' }, _count: { _all: true } }),
  ]);

  const subBy = new Map(subs.map((s) => [s.lodgeId, s]));
  const memberBy = new Map(members.map((m) => [m.lodgeId, m._count._all]));
  const userBy = new Map(users.map((u) => [u.lodgeId, u._count._all]));
  const now = Date.now();

  const rows = lodges.map((l) => {
    const s = subBy.get(l.id) ?? null;
    const access = subscriptionAccess(s ? { status: s.status, trialEndsAt: s.trialEndsAt } : null, now);
    const daysToTrialEnd = s?.trialEndsAt ? Math.ceil((s.trialEndsAt.getTime() - now) / 86_400_000) : null;
    return {
      ...l,
      plan: s?.plan ?? null,
      subStatus: s?.status ?? null,
      billingInterval: s?.billingInterval ?? null,
      paymentMethod: s?.paymentMethod ?? null,
      trialEndsAt: s?.trialEndsAt ?? null,
      currentPeriodEnd: s?.currentPeriodEnd ?? null,
      daysToTrialEnd,
      blocked: access.blocked,
      members: memberBy.get(l.id) ?? 0,
      users: userBy.get(l.id) ?? 0,
    };
  });

  return NextResponse.json({ lodges: rows });
}
