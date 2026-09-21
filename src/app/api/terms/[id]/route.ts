import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const readAccess = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'read');
  if (!readAccess.ok) return NextResponse.json({ error: readAccess.error }, { status: readAccess.status });
  const { id } = await params;
  const item = await withTenant(String(lodgeId), (db) =>
    db.term.findFirst({
      where: { id, lodgeId: String(lodgeId) },
      include: {
        memberOffices: { include: { member: { select: { id: true, name: true } }, office: { select: { id: true, name: true, order: true } } } },
        cashCloses: true,
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
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;

  const result = await withTenant(String(lodgeId), async (db) => {
    const prev = await db.term.findFirst({
      where: { id, lodgeId: String(lodgeId) },
      select: { id: true, title: true, status: true, _count: { select: { cashCloses: true } } },
    });
    if (!prev) return { error: 'notfound' as const };
    // Nunca deixa apagar um período que já tem fechamento de caixa (mesmo não
    // aprovado) ou que já foi encerrado — isso destruiria histórico financeiro
    // real. Um período "vazio" criado por engano pode ser removido livremente.
    if (prev.status === 'closed' || prev._count.cashCloses > 0) return { error: 'hasData' as const };

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'term', entityId: id, metadata: { title: prev.title } });
    await db.term.deleteMany({ where: { id, lodgeId: String(lodgeId) } });
    return { ok: true as const };
  });

  if ('error' in result) {
    if (result.error === 'notfound') return NextResponse.json({ error: 'Período não encontrado.' }, { status: 404 });
    return NextResponse.json({ error: 'Este período já tem fechamento de caixa ou foi encerrado — não pode ser excluído.' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
