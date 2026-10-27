import { auth } from '@/lib/auth';
import { cancelAgreement } from '@/lib/member-block-server';
import { canCancelAgreement, checkCancelReason } from '@/lib/member-block';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Cancela o acordo do irmão: as dívidas voltam ao que eram e o irmão SEGUE bloqueado (Art. 002). Só o Venerável.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!canCancelAgreement(session.user.role)) {
    return NextResponse.json({ error: 'Só o Venerável Mestre pode cancelar um acordo.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const why = checkCancelReason(body?.reason);
  if (!why.ok) return NextResponse.json({ error: why.error }, { status: 400 });
  const result = await cancelAgreement(String(lodgeId), id, String(session.user.id), why.reason);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
