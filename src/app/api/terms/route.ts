import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { invalidateCargoRoles, requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const items = await withTenant(String(lodgeId), (db) =>
    db.term.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { _count: { select: { memberOffices: true } } },
      orderBy: { startDate: 'desc' },
    }),
  );
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json();
  const title = String(body?.title ?? '').trim();
  const startDate = body?.startDate ? new Date(body.startDate) : new Date();
  const endDate = body?.endDate ? new Date(body.endDate) : null;
  const notes = body?.notes ? String(body.notes) : null;
  if (!title) return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 });
  const item = await withTenant(String(lodgeId), async (db) => {
    // Herança de saldo: o novo veneralato abre o livro caixa com o saldo final
    // (closingBalance) do último período encerrado e aprovado.
    const lastClose = await db.cashClose.findFirst({
      where: { lodgeId: String(lodgeId), approved: true },
      orderBy: { closedAt: 'desc' },
      select: { closingBalance: true, term: { select: { title: true } } },
    });
    const openingBalance = Number(lastClose?.closingBalance ?? 0);

    const created = await db.term.create({
      data: { lodgeId: String(lodgeId), title, startDate, endDate, notes, openingBalance },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'term', entityId: created.id, metadata: { title, openingBalance, inheritedFrom: lastClose?.term?.title ?? null } });
    return created;
  });
  invalidateCargoRoles(String(lodgeId));
  return NextResponse.json({ item });
}
