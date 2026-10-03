import { auth } from '@/lib/auth';
import { isCandidateRole } from '@/lib/candidate';
import { withTenant } from '@/lib/prisma';
import { loadDocumentViewer } from '@/lib/documents-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { canViewMinutes } from '@/lib/session-minutes';
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

  // Agenda e atas são do obreiro: o candidato (profano) não as vê.
  if (isCandidateRole(role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const access = await requireLodgeAccess(String(lodgeId), role, 'portal', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), async (db) => {
    const [rows, viewer] = await Promise.all([
      db.session.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, title: true, date: true, endDate: true, type: true, grade: true, agenda: true, minutes: true, convocationSentAt: true, minutesFiles: { select: { degree: true, fileName: true }, orderBy: { degree: 'asc' } } },
        orderBy: { date: 'asc' },
      }),
      loadDocumentViewer(db, String(lodgeId), session),
    ]);
    // Um balaustre por grau: cada irmão só recebe o do seu grau e dos inferiores.
    return rows.map((r) => ({ ...r, minutesFiles: r.minutesFiles.filter((m) => canViewMinutes(m.degree, viewer)) }));
  });

  return NextResponse.json({ items });
}
