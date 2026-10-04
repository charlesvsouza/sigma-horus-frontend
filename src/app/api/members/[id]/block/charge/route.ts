import { auth } from '@/lib/auth';
import { canHandleAgreementCharge, parseChargeTarget } from '@/lib/agreement-charge';
import { confirmAgreementWhatsApp, prepareAgreementCharge, recordAgreementWhatsAppHandoff, sendAgreementEmail } from '@/lib/agreement-charge-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// Cobrança das parcelas do acordo (quitação ou regularização) — sempre pelo Pix da chave da loja, em qualquer
// modo de recebimento (modo híbrido: o acordo nunca passa pelo Asaas). Tesoureiro, Venerável e Administrador
// geram o QR / Pix copia e cola e enviam por WhatsApp (wa.me, quem envia é a pessoa) ou por e-mail.
//  GET   ?target=1|2|…|balance → Pix, QR e mensagem prontos
//  POST  { target, channel: 'whatsapp' | 'email', text? } → registra a abertura no WhatsApp / envia o e-mail
//  PATCH { logId, sent } → confirmação de quem enviou pelo WhatsApp ("Sim, enviei" / "Não enviei")

async function guard(write = false) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'read');
  if (!access.ok) return { ok: false as const, res: NextResponse.json({ error: access.error }, { status: access.status }) };
  if (!canHandleAgreementCharge(session?.user?.role)) {
    return { ok: false as const, res: NextResponse.json({ error: 'Só o Tesoureiro, o Venerável ou o Administrador geram a cobrança do acordo.' }, { status: 403 }) };
  }
  // Enviar/registrar é escrita: exige assinatura vigente (a geração do QR, só leitura, segue liberada).
  if (write) {
    const sub = await requireActiveSubscription(lodgeId);
    if (!sub.ok) return { ok: false as const, res: NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status }) };
  }
  return { ok: true as const, lodgeId };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const target = parseChargeTarget(new URL(request.url).searchParams.get('target'));
  if (target == null) return NextResponse.json({ error: 'Escolha a parcela (ou o saldo) a cobrar.' }, { status: 400 });
  const p = await prepareAgreementCharge(g.lodgeId, id, target);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: p.status });
  return NextResponse.json({
    blockId: p.blockId, memberName: p.memberName, phone: p.phone, rawPhone: p.rawPhone, email: p.email,
    target: String(p.charge.target), number: p.charge.number, amount: p.charge.amount, dueDate: p.charge.dueDate.toISOString(), late: p.charge.late,
    pixCopyPaste: p.pixCopyPaste, qrDataUrl: p.qrDataUrl, text: p.text, subject: p.subject,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(true);
  if (!g.ok) return g.res;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const target = parseChargeTarget(body?.target);
  if (target == null) return NextResponse.json({ error: 'Escolha a parcela (ou o saldo) a cobrar.' }, { status: 400 });
  const p = await prepareAgreementCharge(g.lodgeId, id, target);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: p.status });

  if (body?.channel === 'email') {
    const r = await sendAgreementEmail(g.lodgeId, p);
    if (!r.ok) return NextResponse.json({ error: r.detail ?? 'Não foi possível enviar o e-mail.', status: r.status }, { status: r.status === 'failed' ? 400 : 502 });
    return NextResponse.json({ success: true, to: p.email });
  }
  if (body?.channel === 'whatsapp') {
    const text = typeof body?.text === 'string' && body.text.trim() ? body.text : p.text;
    const logId = await recordAgreementWhatsAppHandoff(g.lodgeId, p, text);
    return NextResponse.json({ success: true, logId });
  }
  return NextResponse.json({ error: 'Escolha o canal: WhatsApp ou e-mail.' }, { status: 400 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(true);
  if (!g.ok) return g.res;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const logId = typeof body?.logId === 'string' ? body.logId : '';
  if (!logId || typeof body?.sent !== 'boolean') return NextResponse.json({ error: 'Informe o registro e se a mensagem foi enviada.' }, { status: 400 });
  const ok = await confirmAgreementWhatsApp(g.lodgeId, id, logId, body.sent);
  if (!ok) return NextResponse.json({ error: 'Registro de envio não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
