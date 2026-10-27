import { auth } from '@/lib/auth';
import { parseChargeTarget } from '@/lib/agreement-charge';
import { submitAgreementNotice } from '@/lib/agreement-charge-server';
import { PORTAL_WRITE_DENIED } from '@/lib/portal-dues';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// "Já paguei" de uma parcela do próprio acordo: avisa a Tesouraria/Venerável/Administrador por e-mail.
// Não dá baixa em nada.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  if (!lodgeId || !memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'portal', 'write');
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? PORTAL_WRITE_DENIED : access.error }, { status: access.status });

  // Aceita JSON { target, note } ou formulário (multipart) com target + note + file (comprovante, opcional).
  let body: Record<string, unknown> = {};
  let file: File | null = null;
  if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    body = { target: form?.get('target'), note: form?.get('note') };
    const f = form?.get('file');
    file = f instanceof File && f.size > 0 ? f : null;
  } else {
    body = (await request.json().catch(() => ({}))) ?? {};
  }
  const target = parseChargeTarget(body?.target);
  if (target == null) return NextResponse.json({ error: 'Escolha a parcela paga.' }, { status: 400 });
  const r = await submitAgreementNotice(lodgeId, memberId, session!.user.id, target, String(body?.note ?? ''), file);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, notified: r.notified, noticeAt: r.noticeAt });
}
