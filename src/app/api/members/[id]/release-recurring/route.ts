import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { releaseMemberRecurring } from '@/lib/recurring';
import { NextResponse } from 'next/server';

// Libera a recorrência de um membro retido no Art. 002: depois da negociação, o Tesoureiro (ou o
// Venerável, se a matriz de permissões der escrita em Contas) gera de uma vez todas as parcelas
// pendentes. Sem esta ação, a recorrência do membro fica parada.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id: memberId } = await params;
  const member = await withTenant(String(lodgeId), (db) => db.member.findFirst({ where: { id: memberId, lodgeId: String(lodgeId) }, select: { id: true, name: true } }));
  if (!member) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });

  const result = await releaseMemberRecurring(String(lodgeId), member.id, String(session.user.id));

  await withTenant(String(lodgeId), (db) =>
    logAudit(db, {
      lodgeId: String(lodgeId),
      userId: String(session.user.id),
      action: 'UPDATE',
      entity: 'member',
      entityId: member.id,
      metadata: { action: 'release-recurring', ...result },
    }),
  );

  if (result.generated === 0 && result.locked > 0) {
    return NextResponse.json({ error: 'As parcelas pendentes caem num veneralato já encerrado e não puderam ser geradas.', ...result }, { status: 409 });
  }
  return NextResponse.json(result);
}
