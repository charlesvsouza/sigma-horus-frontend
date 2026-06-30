import { auth } from '@/lib/auth';
import { requireLodgeAccess } from '@/lib/rbac';
import { getClosingReport } from '@/lib/closing-report';
import { NextResponse } from 'next/server';

// Suíte de relatórios de fechamento do veneralato (computação em lib/closing-report.ts).
export async function GET(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const url = new URL(request.url);
  const report = await getClosingReport(String(lodgeId), url.searchParams.get('from'), url.searchParams.get('to'));
  return NextResponse.json(report);
}
