import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await withTenant(String(lodgeId), (db) =>
    db.rite.deleteMany({ where: { id, lodgeId: String(lodgeId) } }),
  );

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  }

  await withTenant(String(lodgeId), (db) =>
    db.rite.updateMany({ where: { id, lodgeId: String(lodgeId) }, data: { name } }),
  );

  return NextResponse.json({ ok: true });
}
