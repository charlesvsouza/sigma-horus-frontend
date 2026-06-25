import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = requireAccess(role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.chartAccount.findMany({
      where: { lodgeId: String(lodgeId) },
      orderBy: { code: 'asc' },
    }),
  );

  return NextResponse.json({ items });
}
