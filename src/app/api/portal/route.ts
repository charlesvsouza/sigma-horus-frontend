import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'portal', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const [member, accounts, documents] = await Promise.all([
    withTenant(String(lodgeId), (db) =>
      db.member.findFirst({
        where: { lodgeId: String(lodgeId) },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          currentDegree: true,
          originLodge: true,
          initiationDate: true,
          elevationDate: true,
          exaltationDate: true,
          installationDate: true,
          gradeName: true,
        },
      }),
    ),
    withTenant(String(lodgeId), (db) =>
      db.account.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, title: true, type: true, amount: true, dueDate: true, status: true },
        orderBy: { dueDate: 'asc' },
      }),
    ),
    withTenant(String(lodgeId), (db) =>
      db.document.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, title: true, kind: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ),
  ]);

  const totalReceivables = accounts.filter((item) => item.type === 'RECEIVABLE').reduce((sum, item) => sum + Number(item.amount), 0);
  const totalPayables = accounts.filter((item) => item.type === 'PAYABLE').reduce((sum, item) => sum + Number(item.amount), 0);
  const pending = accounts.filter((item) => item.status === 'pending').reduce((sum, item) => sum + Number(item.amount), 0);

  return NextResponse.json({ member, accounts, documents, summary: { totalReceivables, totalPayables, pending } });
}
