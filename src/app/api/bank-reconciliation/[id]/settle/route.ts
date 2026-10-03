import { auth } from '@/lib/auth';
import { settleFromBankLine } from '@/lib/bank-settle-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Baixa assistida: dá baixa na cobrança escolhida com o valor do crédito do extrato e concilia a linha.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const accountId = String(body?.accountId ?? '').trim();
  const bankAccountId = String(body?.bankAccountId ?? '').trim();
  if (!accountId || !bankAccountId) return NextResponse.json({ error: 'Escolha a cobrança e a conta que recebeu o crédito.' }, { status: 400 });

  const result = await settleFromBankLine(String(lodgeId), String(session.user.id), { bankTxId: id, accountId, bankAccountId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, paymentId: result.paymentId });
}
