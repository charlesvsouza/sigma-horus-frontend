import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { syncChartAccounts } from '@/lib/seed-lodge';
import { NextResponse } from 'next/server';

// Sincroniza o plano de contas da loja com o padrão canônico (AMORIO):
// adiciona as contas que faltam e remove os defaults antigos não vinculados.
export async function POST() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const stats = await withTenant(String(lodgeId), async (db) => {
    const result = await syncChartAccounts(db, String(lodgeId));
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'chart-account',
      entityId: 'sync',
      metadata: result,
    });
    return result;
  });

  return NextResponse.json({ ok: true, stats });
}
