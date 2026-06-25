import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const item = await withTenant(String(lodgeId), (db) =>
    db.session.findFirst({
      where: { id, lodgeId: String(lodgeId) },
      include: {
        attendances: {
          include: { member: { select: { id: true, name: true } } },
        },
      },
    }),
  );
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await withTenant(String(lodgeId), (db) =>
    db.session.deleteMany({ where: { id, lodgeId: String(lodgeId) } }),
  );
  return NextResponse.json({ ok: true });
}
