import { auth } from '@/lib/auth';
import { settleAgreementFromBankLine } from '@/lib/bank-settle-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Baixa assistida do ACORDO: o crédito do extrato paga parcela (ou saldo) do acordo em aberto do irmão e a linha é conciliada.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const memberId = String(body?.memberId ?? '').trim();
  const bankAccountId = String(body?.bankAccountId ?? '').trim();
  if (!memberId || !bankAccountId) return NextResponse.json({ error: 'Escolha o acordo e a conta que recebeu o crédito.' }, { status: 400 });

  const result = await settleAgreementFromBankLine(String(lodgeId), String(session.user.id), { bankTxId: id, memberId, bankAccountId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, paymentId: result.paymentId });
}
