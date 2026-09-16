import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { seedDefaultMaterials } from '@/lib/seed-lodge';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'materials', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const stats = await withTenant(String(lodgeId), async (db) => {
    const s = await seedDefaultMaterials(db, String(lodgeId));
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session!.user.id,
      action: 'CREATE',
      entity: 'material',
      entityId: 'seed-defaults',
      metadata: s,
    });
    return s;
  });

  return NextResponse.json({ ok: true, ...stats });
}
