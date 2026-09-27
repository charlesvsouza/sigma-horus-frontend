import { auth } from '@/lib/auth';
import { submitPaymentNotice } from '@/lib/payment-notice-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// "Já paguei" (Modo Loja) de uma conta — regras em lib/payment-notice-server.ts.
// Aceita JSON { note } ou formulário (multipart) com note + file (comprovante).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  if (!lodgeId || !memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'portal', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  let note = '';
  let file: File | null = null;
  if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    note = String(form?.get('note') ?? '');
    const f = form?.get('file');
    file = f instanceof File && f.size > 0 ? f : null;
  } else {
    const body = await request.json().catch(() => ({}));
    note = String(body?.note ?? '');
  }

  const r = await submitPaymentNotice({ lodgeId, memberId, userId: session!.user.id, accountIds: [id], note, file });
  if (!r.ok) return NextResponse.json({ error: r.error, ...(r.paidNoticeAt ? { paidNoticeAt: r.paidNoticeAt } : {}) }, { status: r.status });
  return NextResponse.json({ success: true, paidNoticeAt: r.paidNoticeAt, notified: r.notified, receipt: r.receipt });
}
