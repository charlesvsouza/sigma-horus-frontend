import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { dispatch, sleep, DISPATCH_THROTTLE_MS, type Channel } from '@/lib/messaging';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

const VALID_CHANNELS: Channel[] = ['email', 'whatsapp', 'sms'];

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'messages', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const items = await withTenant(String(lodgeId), (db) =>
    db.messageLog.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { member: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'messages', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json();
  const title = String(body?.title ?? '').trim();
  const channelRaw = String(body?.channel ?? 'email');
  const content = String(body?.content ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;

  if (!title || !content) {
    return NextResponse.json({ error: 'Título e conteúdo são obrigatórios.' }, { status: 400 });
  }
  if (!VALID_CHANNELS.includes(channelRaw as Channel)) {
    return NextResponse.json({ error: 'Canal inválido.' }, { status: 400 });
  }
  const channel = channelRaw as Channel;

  const stats = { sent: 0, queued: 0, failed: 0, skipped: 0 };

  // Etapa 1 (transação curta): só leitura. O laço de despacho abaixo roda
  // FORA de qualquer transação — ele chama provedores externos (Resend/
  // WhatsApp/Twilio) com uma pausa entre cada envio (DISPATCH_THROTTLE_MS),
  // e uma transação interativa do Prisma expira em 5s por padrão. Pra loja
  // com dezenas de membros isso estourava o timeout e derrubava o envio
  // inteiro com "query cannot be executed on an expired transaction".
  const setup = await withTenant(String(lodgeId), async (db) => {
    const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: LODGE_MESSAGING_SELECT });
    // Sem memberId: manda a todos os membros ativos. Com memberId: só a ele
    // (mesmo que inativo — foi uma escolha explícita de quem enviou).
    const members = memberId
      ? await db.member.findMany({ where: { id: memberId, lodgeId: String(lodgeId) }, select: { id: true, name: true, email: true, phone: true } })
      : await db.member.findMany({ where: { lodgeId: String(lodgeId), status: 'active' }, select: { id: true, name: true, email: true, phone: true } });
    return { lodge, members };
  });

  if (setup.members.length === 0) {
    return NextResponse.json({ error: memberId ? 'Membro não encontrado.' : 'Nenhum membro ativo para enviar.' }, { status: 400 });
  }

  const lodgeChannels = buildLodgeChannels(setup.lodge);

  // Etapa 2: laço de despacho, sem transação aberta. Cada MessageLog é
  // gravado na sua própria transação curta (RLS continua garantido).
  let lastItem = null;
  let dispatched = 0;
  for (const m of setup.members) {
    const to = channel === 'email' ? (m.email ?? '') : (m.phone ?? '');
    if (!to) { stats.skipped++; continue; }
    if (dispatched > 0) await sleep(DISPATCH_THROTTLE_MS);
    dispatched++;
    const r = await dispatch(channel, to, title, content, lodgeChannels);
    stats[r.status]++;
    lastItem = await withTenant(String(lodgeId), (db) =>
      db.messageLog.create({
        data: { lodgeId: String(lodgeId), memberId: m.id, channel, title, content, status: r.status, error: r.detail ?? null },
        include: { member: { select: { id: true, name: true } } },
      }),
    );
  }

  if (stats.sent === 0 && stats.queued === 0 && stats.failed === 0 && stats.skipped > 0) {
    return NextResponse.json({ error: 'Ninguém com contato cadastrado para este canal.' }, { status: 400 });
  }

  // Etapa 3 (transação curta): auditoria.
  await withTenant(String(lodgeId), (db) =>
    logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'message', entityId: lastItem?.id ?? 'broadcast', metadata: { channel, memberId, ...stats } }),
  );

  return NextResponse.json({ item: lastItem, stats });
}
