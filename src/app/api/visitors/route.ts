import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Busca no cadastro de visitantes (sugestão ao digitar o nome ou o e-mail na sessão):
// o mesmo irmão que volta não é cadastrado de novo. Anonimizados ficam de fora.
export async function GET(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'members', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ items: [] });

  const items = await withTenant(lodgeId, (db) => db.visitor.findMany({
    where: {
      lodgeId,
      anonymizedAt: null,
      OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }],
    },
    select: {
      id: true, name: true, degree: true, lodgeName: true, lodgeNumber: true, orient: true, powerName: true, cim: true, phone: true, email: true,
      _count: { select: { visits: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 8,
  }));
  return NextResponse.json({ items: items.map(({ _count, ...v }) => ({ ...v, visits: _count.visits })) });
}
