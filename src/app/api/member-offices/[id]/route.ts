import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { invalidateCargoRoles, requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Corrige ou remove o vínculo obreiro × cargo de um período (vínculo feito por
// engano, troca de titular). Período encerrado não muda: é o registro histórico
// da gestão.

const CLOSED = 'Este veneralato já foi encerrado e não pode mais ser alterado.';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const newMemberId = body?.memberId ? String(body.memberId) : null;
  const newOfficeId = body?.officeId ? String(body.officeId) : null;
  if (!newMemberId && !newOfficeId) {
    return NextResponse.json({ error: 'Informe o obreiro e/ou o cargo a alterar.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const link = await db.memberOffice.findFirst({
      where: { id, lodgeId: String(lodgeId) },
      include: { term: { select: { status: true } } },
    });
    if (!link) return { error: 'notfound' as const };
    if (link.term.status === 'closed') return { error: 'closed' as const };

    const memberId = newMemberId ?? link.memberId;
    const officeId = newOfficeId ?? link.officeId;
    if (memberId === link.memberId && officeId === link.officeId) return { item: link }; // nada mudou

    const [member, office] = await Promise.all([
      newMemberId ? db.member.findFirst({ where: { id: memberId, lodgeId: String(lodgeId) }, select: { id: true } }) : Promise.resolve({ id: memberId }),
      newOfficeId ? db.office.findFirst({ where: { id: officeId, lodgeId: String(lodgeId) }, select: { id: true } }) : Promise.resolve({ id: officeId }),
    ]);
    if (!member) return { error: 'member' as const };
    if (!office) return { error: 'office' as const };

    const duplicate = await db.memberOffice.findUnique({
      where: { memberId_officeId_termId: { memberId, officeId, termId: link.termId } },
      select: { id: true },
    });
    if (duplicate && duplicate.id !== id) return { error: 'duplicate' as const };

    const updated = await db.memberOffice.update({ where: { id }, data: { memberId, officeId } });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'memberOffice',
      entityId: id,
      metadata: { from: { memberId: link.memberId, officeId: link.officeId }, to: { memberId, officeId }, termId: link.termId },
    });
    return { item: updated };
  });

  if ('error' in result) {
    switch (result.error) {
      case 'notfound':
        return NextResponse.json({ error: 'Vínculo não encontrado.' }, { status: 404 });
      case 'closed':
        return NextResponse.json({ error: CLOSED }, { status: 409 });
      case 'member':
        return NextResponse.json({ error: 'Obreiro não encontrado.' }, { status: 404 });
      case 'office':
        return NextResponse.json({ error: 'Cargo não encontrado.' }, { status: 404 });
      default:
        return NextResponse.json({ error: 'Este obreiro já tem este cargo neste período.' }, { status: 409 });
    }
  }
  invalidateCargoRoles(String(lodgeId));
  return NextResponse.json({ item: result.item });
}

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
      : NextResponse.json({ error: CLOSED }, { status: 409 });
  }
  invalidateCargoRoles(String(lodgeId));
  return NextResponse.json({ success: true });
}
