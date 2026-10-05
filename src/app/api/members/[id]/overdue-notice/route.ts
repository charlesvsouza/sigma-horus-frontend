import { auth } from '@/lib/auth';
import { loadOverdueNotices, noticeWhatsAppText } from '@/lib/overdue-notice-server';
import { OVERDUE_NOTICE_WHATSAPP_LOG_TITLE, overdueNoticeRef } from '@/lib/overdue-notice';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { WHATSAPP_MANUAL_CHANNEL } from '@/lib/whatsapp-link';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Aviso de inadimplência pelo WhatsApp (wa.me, manual): quem envia é o Tesoureiro, o sistema só monta o texto.
//  GET   → texto, telefone e último aviso.  POST → registra a abertura ({ text }) e devolve logId.
//  PATCH → confirmação do usuário ({ logId, sent }): "sent" ou apaga o registro.
// O aviso só existe enquanto o irmão estiver ativo e em atraso; o texto sai SEMPRE do que está no banco.

const MAX_TEXT = 4000;
const GONE = 'Este irmão não está mais na lista de inadimplência (pagou ou não está ativo).';

async function guard() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'write');
  if (!access.ok) return { ok: false as const, res: NextResponse.json({ error: access.error }, { status: access.status }) };
  return { ok: true as const, lodgeId };
}

export async function GET(_request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const ctx = await loadOverdueNotices(g.lodgeId, [id]);
  const m = ctx?.members[0];
  if (!m) return NextResponse.json({ error: GONE }, { status: 409 });
  return NextResponse.json({
    memberId: m.memberId, memberName: m.name, phone: m.phone, rawPhone: m.rawPhone,
    count: m.input.count, total: m.input.total, daysOverdue: m.input.daysOverdue,
    text: noticeWhatsAppText(m), lastSentAt: m.lastSentAt,
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
  if (!text) return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 });
  const ctx = await loadOverdueNotices(g.lodgeId, [id]);
  if (!ctx?.members[0]) return NextResponse.json({ error: GONE }, { status: 409 });
  const log = await withTenant(g.lodgeId, (db) => db.messageLog.create({
    select: { id: true },
    data: { lodgeId: g.lodgeId, memberId: id, channel: WHATSAPP_MANUAL_CHANNEL, status: 'handed-off', title: OVERDUE_NOTICE_WHATSAPP_LOG_TITLE, content: text, ref: overdueNoticeRef(id) },
  }));
  return NextResponse.json({ success: true, logId: log.id });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const logId = typeof body?.logId === 'string' ? body.logId : '';
  if (!logId || typeof body?.sent !== 'boolean') return NextResponse.json({ error: 'Informe o registro e se a mensagem foi enviada.' }, { status: 400 });
  const found = await withTenant(g.lodgeId, async (db) => {
    const log = await db.messageLog.findFirst({ where: { id: logId, lodgeId: g.lodgeId, ref: overdueNoticeRef(id), channel: WHATSAPP_MANUAL_CHANNEL, status: 'handed-off' }, select: { id: true } });
    if (!log) return false;
    if (body.sent) await db.messageLog.update({ where: { id: log.id }, data: { status: 'sent' } });
    else await db.messageLog.delete({ where: { id: log.id } });
    return true;
  });
  if (!found) return NextResponse.json({ error: 'Registro de envio não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
