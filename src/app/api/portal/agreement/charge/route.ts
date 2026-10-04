import { auth } from '@/lib/auth';
import { parseChargeTarget } from '@/lib/agreement-charge';
import { prepareAgreementCharge } from '@/lib/agreement-charge-server';
import { PORTAL_WRITE_DENIED } from '@/lib/portal-dues';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// "Meu acordo" (portal): o irmão gera o Pix da parcela (ou do saldo todo) do PRÓPRIO acordo — sempre na chave
// Pix da loja, em qualquer modo de recebimento. A baixa é da Tesouraria; aqui nada é gravado.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  if (!lodgeId || !memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'portal', 'write');
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? PORTAL_WRITE_DENIED : access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const target = parseChargeTarget(body?.target);
  if (target == null) return NextResponse.json({ error: 'Escolha a parcela a pagar.' }, { status: 400 });
  const p = await prepareAgreementCharge(lodgeId, memberId, target);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: p.status });
  return NextResponse.json({ amount: p.charge.amount, dueDate: p.charge.dueDate.toISOString(), late: p.charge.late, pixCopyPaste: p.pixCopyPaste, qrImage: p.qrDataUrl });
}
