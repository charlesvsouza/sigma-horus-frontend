import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { deleteObject, getR2PublicStorageSettings } from '@/lib/storage';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_ROLES = ['admin', 'secretary', 'venerable'];

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
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
    const existing = await db.venerableGalleryEntry.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return null;
    const updated = await db.venerableGalleryEntry.update({ where: { id }, data: { name, periodLabel, sortDate, notes } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'venerableGalleryEntry', entityId: id, metadata: { name, periodLabel } });
    return updated;
  });
  if (!item) return NextResponse.json({ error: 'Entrada não encontrada.' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(normalizeRole(session?.user?.role))) {
    return NextResponse.json({ error: 'Apenas Secretário, Venerável ou Administrador podem editar a galeria.' }, { status: 403 });
  }

  const deleted = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.venerableGalleryEntry.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { photoStorageKey: true } });
    if (!existing) return undefined;
    await db.venerableGalleryEntry.delete({ where: { id } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'venerableGalleryEntry', entityId: id, metadata: {} });
    return existing;
  });
  if (deleted === undefined) return NextResponse.json({ error: 'Entrada não encontrada.' }, { status: 404 });
  if (deleted?.photoStorageKey) {
    await deleteObject(deleted.photoStorageKey, getR2PublicStorageSettings()).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
