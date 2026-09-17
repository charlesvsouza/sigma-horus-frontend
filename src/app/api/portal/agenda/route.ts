import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Agenda do obreiro (Secretaria): sessões com data/hora, ordem do dia e
// balaustre — sem os dados de gestão que /api/sessions traz (attendances,
// notas internas do Secretário). Gate por "portal" (não "members"), que é o
// resource que o papel member realmente tem.
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'portal', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.session.findMany({
      where: { lodgeId: String(lodgeId) },
      select: { id: true, title: true, date: true, endDate: true, type: true, grade: true, agenda: true, minutes: true, minutesFileName: true, convocationSentAt: true },
      orderBy: { date: 'asc' },
    }),
  );

  return NextResponse.json({ items });
}
