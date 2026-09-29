import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { convocationRef } from '@/lib/session-convocation';
import { loadConvocation, type LoadedConvocation } from '@/lib/session-convocation-server';
import { normalizeWhatsAppPhone, WHATSAPP_MANUAL_CHANNEL } from '@/lib/whatsapp-link';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Fila de WhatsApp (wa.me, manual) da convocação: manda o MESMO texto do último envio por
// e-mail, a quem foi convocado. Só existe depois do e-mail e enquanto a sessão não mudou —
// alterou, primeiro sai a retificação (e a fila recomeça para a nova rodada).
//  GET   → irmãos convocados + situação nesta rodada (enviada / aberta sem confirmação).
//  POST  → registra a abertura ({ memberId, text }) e devolve logId.
//  PATCH → confirmação do usuário ({ logId, sent }): "sent" ou apaga o registro.

const MAX_TEXT = 4000;

async function guard() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'members', 'write');
  if (!access.ok) return { ok: false as const, res: NextResponse.json({ error: access.error }, { status: access.status }) };
  return { ok: true as const, lodgeId };
}

function ready(c: LoadedConvocation | null) {
  if (!c) return { ok: false as const, res: NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 }) };
  if (!c.sentAt || !c.sentText) return { ok: false as const, res: NextResponse.json({ error: 'Envie a convocação por e-mail primeiro — o WhatsApp repete o mesmo texto.' }, { status: 409 }) };
  if (c.changed) return { ok: false as const, res: NextResponse.json({ error: 'A sessão foi alterada depois da convocação. Envie a retificação antes de continuar pelo WhatsApp.' }, { status: 409 }) };
  return { ok: true as const, c: { ...c, sentAt: c.sentAt, sentText: c.sentText } };
}

export async function GET(_request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const r = ready(await loadConvocation(g.lodgeId, id));
  if (!r.ok) return r.res;
  const { c } = r;

  // Só a rodada atual (envios depois do último e-mail/retificação), do mais recente ao mais antigo.
  const logs = await withTenant(g.lodgeId, (db) => db.messageLog.findMany({
    where: { lodgeId: g.lodgeId, ref: convocationRef(id), channel: WHATSAPP_MANUAL_CHANNEL, createdAt: { gte: c.sentAt } },
    select: { memberId: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  }));
  const sent = new Map<string, string>();
  const opened = new Map<string, string>();
  for (const log of logs) {
    if (!log.memberId) continue;
    if (log.status === 'sent') { if (!sent.has(log.memberId)) sent.set(log.memberId, log.createdAt.toISOString()); }
    else if (log.status === 'handed-off' && !sent.has(log.memberId) && !opened.has(log.memberId)) opened.set(log.memberId, log.createdAt.toISOString());
  }

  return NextResponse.json({
    title: c.meeting.title,
    text: c.sentText,
    rows: c.recipients.map((m) => ({
      memberId: m.id,
      name: m.name,
      phone: normalizeWhatsAppPhone(m.phone),
      rawPhone: m.phone,
      lastSentAt: sent.get(m.id) ?? null,
      lastOpenedAt: opened.get(m.id) ?? null,
    })),
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const r = ready(await loadConvocation(g.lodgeId, id));
  if (!r.ok) return r.res;

  const body = await request.json().catch(() => ({}));
  const memberId = typeof body?.memberId === 'string' ? body.memberId : '';
  const member = r.c.recipients.find((m) => m.id === memberId);
  if (!member) return NextResponse.json({ error: 'Este irmão não está entre os convocados desta sessão.' }, { status: 400 });
  const text = typeof body?.text === 'string' && body.text.trim() ? body.text.slice(0, MAX_TEXT) : r.c.sentText;

  const log = await withTenant(g.lodgeId, (db) => db.messageLog.create({
    select: { id: true },
    data: {
      lodgeId: g.lodgeId, memberId: member.id, channel: WHATSAPP_MANUAL_CHANNEL, status: 'handed-off',
      title: `WhatsApp: convocação — ${r.c.meeting.title}`, content: text, ref: convocationRef(id),
    },
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
    // Só o registro "aberto" desta convocação — não deixa confirmar/apagar outra mensagem da loja.
    const log = await db.messageLog.findFirst({
      where: { id: logId, lodgeId: g.lodgeId, ref: convocationRef(id), channel: WHATSAPP_MANUAL_CHANNEL, status: 'handed-off' },
      select: { id: true },
    });
    if (!log) return false;
    if (body.sent) await db.messageLog.update({ where: { id: log.id }, data: { status: 'sent' } });
    else await db.messageLog.delete({ where: { id: log.id } });
    return true;
  });
  if (!found) return NextResponse.json({ error: 'Registro de envio não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
