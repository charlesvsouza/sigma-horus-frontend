import { auth } from '@/lib/auth';
import { isIncompleteRecord, missingRecordFields, recordRequestRef, recordRequestText } from '@/lib/incomplete-record';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { normalizeWhatsAppPhone, WHATSAPP_MANUAL_CHANNEL } from '@/lib/whatsapp-link';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Pedido de CPF/e-mail pelo WhatsApp (wa.me, manual): a Secretaria abre a conversa com o texto pronto.
// Só existe enquanto o cadastro estiver incompleto — regularizado, a rota responde 409 e o pedido some.
//  GET   → texto, telefone e último envio.  POST → registra a abertura ({ text }) e devolve logId.
//  PATCH → confirmação do usuário ({ logId, sent }): "sent" ou apaga o registro.

const MAX_TEXT = 4000;
const COMPLETE_ERROR = 'Este cadastro já está completo (CPF e e-mail preenchidos).';

async function guard() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'members', 'write');
  if (!access.ok) return { ok: false as const, res: NextResponse.json({ error: access.error }, { status: access.status }) };
  return { ok: true as const, lodgeId };
}

export async function GET(_request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const data = await withTenant(g.lodgeId, async (db) => {
    const [member, lodge, last] = await Promise.all([
      db.member.findFirst({ where: { id, lodgeId: g.lodgeId }, select: { id: true, name: true, cpf: true, email: true, phone: true, status: true, deceased: true } }),
      db.lodge.findUnique({ where: { id: g.lodgeId }, select: { name: true } }),
      db.messageLog.findFirst({ where: { lodgeId: g.lodgeId, memberId: id, ref: recordRequestRef(id), channel: WHATSAPP_MANUAL_CHANNEL, status: 'sent' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    return { member, lodge, last };
  });
  if (!data.member) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
  if (!isIncompleteRecord(data.member)) return NextResponse.json({ error: COMPLETE_ERROR }, { status: 409 });
  const missing = missingRecordFields(data.member);
  return NextResponse.json({
    memberId: data.member.id,
    memberName: data.member.name,
    phone: normalizeWhatsAppPhone(data.member.phone),
    rawPhone: data.member.phone,
    missing,
    text: recordRequestText(data.member.name, data.lodge?.name ?? 'Loja', missing),
    lastSentAt: data.last?.createdAt.toISOString() ?? null,
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
  if (!text) return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 });
  const result = await withTenant(g.lodgeId, async (db) => {
    const member = await db.member.findFirst({ where: { id, lodgeId: g.lodgeId }, select: { id: true, cpf: true, email: true, status: true, deceased: true } });
    if (!member) return { error: 'Membro não encontrado.', status: 404 } as const;
    if (!isIncompleteRecord(member)) return { error: COMPLETE_ERROR, status: 409 } as const;
    const log = await db.messageLog.create({
      select: { id: true },
      data: { lodgeId: g.lodgeId, memberId: id, channel: WHATSAPP_MANUAL_CHANNEL, status: 'handed-off', title: 'WhatsApp: atualização cadastral (CPF/e-mail)', content: text, ref: recordRequestRef(id) },
    });
    return { logId: log.id } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, logId: result.logId });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const logId = typeof body?.logId === 'string' ? body.logId : '';
  if (!logId || typeof body?.sent !== 'boolean') return NextResponse.json({ error: 'Informe o registro e se a mensagem foi enviada.' }, { status: 400 });
  const found = await withTenant(g.lodgeId, async (db) => {
    const log = await db.messageLog.findFirst({ where: { id: logId, lodgeId: g.lodgeId, ref: recordRequestRef(id), channel: WHATSAPP_MANUAL_CHANNEL, status: 'handed-off' }, select: { id: true } });
    if (!log) return false;
    if (body.sent) await db.messageLog.update({ where: { id: log.id }, data: { status: 'sent' } });
    else await db.messageLog.delete({ where: { id: log.id } });
    return true;
  });
  if (!found) return NextResponse.json({ error: 'Registro de envio não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
