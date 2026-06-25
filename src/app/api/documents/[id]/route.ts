import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const { id } = await params;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = requireAccess(role, 'documents', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const item = await withTenant(String(lodgeId), (db) =>
    db.document.findFirst({
      where: { lodgeId: String(lodgeId), id },
      include: { member: { select: { id: true, name: true } } },
    }),
  );

  if (!item) {
    return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const { id } = await params;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = requireAccess(role, 'documents', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  await withTenant(String(lodgeId), (db) => db.document.delete({ where: { id, lodgeId: String(lodgeId) } }));

  return NextResponse.json({ ok: true });
}
