import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { invalidateCargoRoles, requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Remove o vínculo obreiro × cargo de um período (ex.: vínculo feito por engano ou
// troca de titular). Período encerrado não muda: é o registro histórico da gestão.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const result = await withTenant(String(lodgeId), async (db) => {
    const link = await db.memberOffice.findFirst({
      where: { id, lodgeId: String(lodgeId) },
      include: { term: { select: { status: true } }, office: { select: { name: true } } },
    });
    if (!link) return { error: 'notfound' as const };
    if (link.term.status === 'closed') return { error: 'closed' as const };
    await db.memberOffice.delete({ where: { id } });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'DELETE',
      entity: 'memberOffice',
      entityId: id,
      metadata: { memberId: link.memberId, officeId: link.officeId, termId: link.termId, office: link.office.name },
    });
    return { ok: true as const };
  });

  if ('error' in result) {
    return result.error === 'notfound'
      ? NextResponse.json({ error: 'Vínculo não encontrado.' }, { status: 404 })
      : NextResponse.json({ error: 'Este veneralato já foi encerrado e não pode mais ser alterado.' }, { status: 409 });
  }
  invalidateCargoRoles(String(lodgeId));
  return NextResponse.json({ success: true });
}
