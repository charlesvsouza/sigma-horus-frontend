import { auth } from '@/lib/auth';
import { suggestForBankLine } from '@/lib/bank-settle-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Sugestões de cobrança em aberto para um crédito do extrato (por valor e nome do pagador).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const result = await suggestForBankLine(String(lodgeId), id);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
