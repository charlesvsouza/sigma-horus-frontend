import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { seedLodgeDefaults } from '@/lib/seed-lodge';
import { NextResponse } from 'next/server';

// Popula a loja atual com ritos, potências e plano de contas padrão.
// Idempotente: só preenche os grupos que ainda estiverem vazios.
export async function POST() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (normalizeRole(role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem popular os dados padrão.' }, { status: 403 });
  }

  const seeded = await withTenant(String(lodgeId), async (db) => {
    const r = await seedLodgeDefaults(db, String(lodgeId));
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'lodge-seed', entityId: String(lodgeId), metadata: r });
    return r;
  });

  return NextResponse.json({ ok: true, seeded });
}
