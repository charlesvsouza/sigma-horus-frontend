import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Histórico de cargos por membro, através de TODOS os veneralatos — a tela de
// Veneralato só busca MemberOffice do termo selecionado; este endpoint junta
// tudo de uma vez pra montar "quem ocupou o quê, em cada gestão".
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.memberOffice.findMany({
      where: { lodgeId: String(lodgeId) },
      include: {
        member: { select: { id: true, name: true } },
        office: { select: { id: true, name: true } },
        term: { select: { id: true, title: true, startDate: true, endDate: true } },
      },
      orderBy: { term: { startDate: 'desc' } },
    }),
  );
  return NextResponse.json({ items });
}
