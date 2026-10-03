import { auth } from '@/lib/auth';
import { recordAgreementPayment } from '@/lib/member-block-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { round2 } from '@/lib/money';
import { NextResponse } from 'next/server';

// Registra um pagamento do acordo de regularização (à vista ou parcela) e o reparte entre os itens do
// pacote: taxa primeiro, depois a dívida mais antiga. É a Tesouraria quem registra (accounts:write).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const bankAccountId = body?.bankAccountId ? String(body.bankAccountId) : '';
  if (!bankAccountId) return NextResponse.json({ error: 'Selecione a conta bancária/caixa que recebeu o valor.' }, { status: 400 });
  const paidAt = body?.paidAt ? new Date(body.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) return NextResponse.json({ error: 'Data do pagamento inválida.' }, { status: 400 });

  const result = await recordAgreementPayment(String(lodgeId), id, String(session.user.id), {
    amount: round2(Number(body?.amount ?? 0)),
    bankAccountId,
    paidAt,
    method: String(body?.method ?? 'manual').trim().slice(0, 40),
    note: String(body?.note ?? '').trim().slice(0, 300),
    confirmOutsideAsaas: body?.confirmOutsideAsaas === true,
  });
  if (!result.ok) {
    const { status, ...rest } = result;
    return NextResponse.json({ ...rest, ok: undefined }, { status });
  }
  return NextResponse.json({ ok: true, applied: result.applied });
}
