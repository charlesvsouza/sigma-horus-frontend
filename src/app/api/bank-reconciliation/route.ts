import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.bankTransaction.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { matchedPayment: { select: { id: true, amount: true, paidAt: true, account: { select: { title: true } } } } },
      orderBy: { date: 'desc' },
    }),
  );
  return NextResponse.json({ items });
}
