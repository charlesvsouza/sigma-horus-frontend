import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { backfillMemberRelatives } from '@/lib/relatives-backfill';
import { NextResponse } from 'next/server';

// Migra os campos planos antigos (motherName/fatherName/spouseName/childrenNames)
// para a tabela relacional Relative. Idempotente: só processa membros que ainda
// não têm nenhum familiar cadastrado, para não duplicar nem sobrescrever dados
// já inseridos pela nova UI. Escopo: a loja do usuário (RLS).

export async function POST() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const stats = await withTenant(String(lodgeId), async (db) => {
    const result = await backfillMemberRelatives(db, String(lodgeId));
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'member',
      entityId: 'backfill-relatives',
      metadata: result,
    });
    return result;
  });

  return NextResponse.json({ ok: true, stats });
}
