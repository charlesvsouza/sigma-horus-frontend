import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { encryptSecret } from '@/lib/crypto';
import { channelsAvailable } from '@/lib/messaging';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Mensageria BYO por loja: a loja conecta a própria conta WhatsApp (Meta) e/ou
// SMS (Twilio). E-mail é provido pela plataforma. Tokens guardados criptografados.
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lodge = await withTenant(String(lodgeId), (db) =>
    db.lodge.findUnique({ where: { id: String(lodgeId) }, select: LODGE_MESSAGING_SELECT }),
  );
  const avail = channelsAvailable(buildLodgeChannels(lodge));

  return NextResponse.json({
    emailPlatform: avail.email, // e-mail é da plataforma
    whatsapp: {
      configured: avail.whatsapp,
      phoneId: lodge?.whatsappPhoneId ?? null,
      template: lodge?.whatsappTemplate ?? null,
      lang: lodge?.whatsappTemplateLang ?? 'pt_BR',
    },
    sms: {
      configured: avail.sms,
      sid: lodge?.smsAccountSid ?? null,
      from: lodge?.smsFrom ?? null,
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (normalizeRole(role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem configurar integrações.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const channel = String(body?.channel ?? '');

  if (channel === 'whatsapp') {
    const token = String(body?.token ?? '').trim();
    const phoneId = String(body?.phoneId ?? '').trim();
    const template = String(body?.template ?? '').trim();
    const lang = String(body?.lang ?? 'pt_BR').trim() || 'pt_BR';
    if (!token || !phoneId) return NextResponse.json({ error: 'Informe o token e o ID do número (Phone Number ID).' }, { status: 400 });
    await withTenant(String(lodgeId), async (db) => {
      await db.lodge.update({
        where: { id: String(lodgeId) },
        data: { whatsappTokenEnc: encryptSecret(token), whatsappPhoneId: phoneId, whatsappTemplate: template || null, whatsappTemplateLang: lang },
      });
      await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'integration', entityId: 'whatsapp', metadata: { phoneId, hasTemplate: Boolean(template) } });
    });
    return NextResponse.json({ ok: true });
  }

  if (channel === 'sms') {
    const sid = String(body?.sid ?? '').trim();
    const token = String(body?.token ?? '').trim();
    const from = String(body?.from ?? '').trim();
    if (!sid || !token || !from) return NextResponse.json({ error: 'Informe SID, token e número remetente do Twilio.' }, { status: 400 });
    await withTenant(String(lodgeId), async (db) => {
      await db.lodge.update({
        where: { id: String(lodgeId) },
        data: { smsAccountSid: sid, smsAuthTokenEnc: encryptSecret(token), smsFrom: from },
      });
      await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'integration', entityId: 'sms', metadata: { sid, from } });
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Canal inválido.' }, { status: 400 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (normalizeRole(role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem configurar integrações.' }, { status: 403 });
  }

  const channel = new URL(request.url).searchParams.get('channel');
  const data =
    channel === 'whatsapp' ? { whatsappTokenEnc: null, whatsappPhoneId: null, whatsappTemplate: null }
    : channel === 'sms' ? { smsAuthTokenEnc: null, smsAccountSid: null, smsFrom: null }
    : null;
  if (!data) return NextResponse.json({ error: 'Canal inválido.' }, { status: 400 });

  await withTenant(String(lodgeId), async (db) => {
    await db.lodge.update({ where: { id: String(lodgeId) }, data });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'integration', entityId: channel! });
  });
  return NextResponse.json({ ok: true });
}
