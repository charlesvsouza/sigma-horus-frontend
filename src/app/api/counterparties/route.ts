import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

const KINDS = ['client', 'supplier', 'both'];

export async function GET(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind');
  const q = searchParams.get('q')?.trim();

  const items = await withTenant(String(lodgeId), (db) =>
    db.counterparty.findMany({
      where: {
        lodgeId: String(lodgeId),
        ...(kind && KINDS.includes(kind) ? { kind } : {}),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const name = String(body?.name ?? '').trim();
  const kind = String(body?.kind ?? 'supplier').trim();

  if (!name) {
    return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Tipo deve ser client, supplier ou both.' }, { status: 400 });
  }

  const document = body?.document ? String(body.document).trim() : null;

  try {
    const created = await withTenant(String(lodgeId), async (db) => {
      const item = await db.counterparty.create({
        data: {
          lodgeId: String(lodgeId),
          kind,
          name,
          legalName: body?.legalName ? String(body.legalName).trim() : null,
          document: document || null,
          isCompany: Boolean(body?.isCompany),
          email: body?.email ? String(body.email).trim() : null,
          phone: body?.phone ? String(body.phone).trim() : null,
          addressLine: body?.addressLine ? String(body.addressLine).trim() : null,
          city: body?.city ? String(body.city).trim() : null,
          state: body?.state ? String(body.state).trim() : null,
          zipCode: body?.zipCode ? String(body.zipCode).trim() : null,
          category: body?.category ? String(body.category).trim() : null,
          notes: body?.notes ? String(body.notes).trim() : null,
        },
      });
      await logAudit(db, {
        lodgeId: String(lodgeId),
        userId: session!.user.id,
        action: 'CREATE',
        entity: 'counterparty',
        entityId: item.id,
        metadata: { name, kind, document },
      });
      return item;
    });

    return NextResponse.json({ item: created });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe uma contraparte com esse documento nesta loja.' }, { status: 409 });
    }
    throw error;
  }
}
