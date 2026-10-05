import { auth } from '@/lib/auth';
import { firstInvalidDate, INVALID_DATE_MESSAGE, todayBR } from '@/lib/date-only';
import { recordAgreementPayment } from '@/lib/member-block-server';
import { canBlockMembers } from '@/lib/member-block';
import { requireLodgeAccess } from '@/lib/rbac';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { round2 } from '@/lib/money';
import { NextResponse } from 'next/server';

// Registra um pagamento do acordo de regularização (à vista ou parcela) e o reparte entre os itens do
// pacote: taxa primeiro, depois a dívida mais antiga. Registram o Tesoureiro/Administrador (accounts:write) e o
// Venerável (decisão do dono, 2026-10-04: o acordo é gerido pelos três).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const write = await requireLodgeAccess(String(lodgeId), session.user.role, 'accounts', 'write');
  if (!write.ok && !canBlockMembers(session.user.role)) return NextResponse.json({ error: write.error }, { status: write.status });
  // O Venerável não tem accounts:write, então a assinatura vigente é conferida aqui (a baixa é escrita).
  const sub = await requireActiveSubscription(String(lodgeId));
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const badDate = firstInvalidDate(body, ['paidAt']);
  if (badDate) return NextResponse.json({ error: `${INVALID_DATE_MESSAGE} (campo: ${badDate})` }, { status: 400 });
  const bankAccountId = body?.bankAccountId ? String(body.bankAccountId) : '';
  if (!bankAccountId) return NextResponse.json({ error: 'Selecione a conta bancária/caixa que recebeu o valor.' }, { status: 400 });
  const paidAt = body?.paidAt ? new Date(body.paidAt) : todayBR();
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
