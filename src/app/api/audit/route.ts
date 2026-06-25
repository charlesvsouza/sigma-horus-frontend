import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });

  const items = await withTenant(String(lodgeId), (db) =>
    db.auditLog.findMany({
      where: { lodgeId: String(lodgeId) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  );

  return NextResponse.json({ items });
}
