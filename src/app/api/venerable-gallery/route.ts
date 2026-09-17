import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole, requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Entradas manuais da Galeria de Veneráveis (Veneráveis históricos sem
// cadastro de Member). Manutenção é prerrogativa do Secretário, Venerável e
// Administrador — não a matriz geral de RBAC de "members" (que por padrão
// não dá write ao Venerável).
const ALLOWED_ROLES = ['admin', 'secretary', 'venerable'];

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const items = await withTenant(String(lodgeId), (db) =>
    db.venerableGalleryEntry.findMany({
      where: { lodgeId: String(lodgeId) },
      orderBy: { sortDate: 'asc' },
    }),
  );
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(normalizeRole(session?.user?.role))) {
    return NextResponse.json({ error: 'Apenas Secretário, Venerável ou Administrador podem editar a galeria.' }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body?.name ?? '').trim();
  const periodLabel = String(body?.periodLabel ?? '').trim();
  const sortDateRaw = String(body?.sortDate ?? '');
  const notes = body?.notes ? String(body.notes).trim() : null;
  if (!name || !periodLabel || !sortDateRaw) {
    return NextResponse.json({ error: 'Nome, período e data de referência são obrigatórios.' }, { status: 400 });
  }
  const sortDate = new Date(sortDateRaw);
  if (Number.isNaN(sortDate.getTime())) {
    return NextResponse.json({ error: 'Data de referência inválida.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    const created = await db.venerableGalleryEntry.create({
      data: { lodgeId: String(lodgeId), name, periodLabel, sortDate, notes },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'venerableGalleryEntry', entityId: created.id, metadata: { name, periodLabel } });
    return created;
  });
  return NextResponse.json({ item });
}
