import { auth } from '@/lib/auth';
import { submitPaymentNotice } from '@/lib/payment-notice-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// "Já paguei" de um Pix agrupado (Modo Loja): um aviso por conta, um e-mail, um comprovante.
// Formulário (multipart): accountIds (JSON), note, file (opcional).
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  if (!lodgeId || !memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'portal', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Envie como formulário.' }, { status: 400 });
  let accountIds: string[] = [];
  try {
    const parsed = JSON.parse(String(form.get('accountIds') ?? '[]'));
    accountIds = Array.isArray(parsed) ? parsed.map(String).slice(0, 24) : [];
  } catch {
    accountIds = [];
  }
  if (accountIds.length < 2) return NextResponse.json({ error: 'Informe as contas pagas juntas.' }, { status: 400 });
  const f = form.get('file');

  const r = await submitPaymentNotice({
    lodgeId, memberId, userId: session!.user.id, accountIds,
    note: String(form.get('note') ?? ''),
    file: f instanceof File && f.size > 0 ? f : null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, paidNoticeAt: r.paidNoticeAt, notified: r.notified, receipt: r.receipt });
}
