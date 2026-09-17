import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { dispatch, sleep, DISPATCH_THROTTLE_MS, type Channel } from '@/lib/messaging';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };
const VALID: Channel[] = ['email', 'whatsapp', 'sms'];

// Chamado (convocação) da sessão: envia data/hora e ordem do dia a todos os
// obreiros ativos. E-mail sempre disponível (provido pela plataforma);
// WhatsApp/SMS entram se a loja tiver conectado. Mesmo padrão de
// campaigns/[id]/convocar — MessageLog por envio, dedupe é responsabilidade
// de quem chama (marca convocationSentAt pra não deixar reenviar sem querer).
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const requested: Channel[] = Array.isArray(body?.channels) ? body.channels.filter((c: string) => VALID.includes(c as Channel)) : ['email'];
  const channels = requested.length > 0 ? requested : (['email'] as Channel[]);

  const stats = { sent: 0, queued: 0, failed: 0, skipped: 0 };

  // Etapa 1 (transação curta): só leitura. O laço de despacho roda FORA de
  // qualquer transação — uma transação interativa do Prisma expira em 5s por
  // padrão, e esta loja pode ter dezenas de membros ativos × pausa de
  // DISPATCH_THROTTLE_MS entre cada envio, o que passa fácil de 5s e
  // derrubava a convocação inteira com "query cannot be executed on an
  // expired transaction" (visto em produção).
  const setup = await withTenant(String(lodgeId), async (db) => {
    const meeting = await db.session.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!meeting) return null;
    const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { ...LODGE_MESSAGING_SELECT } });
    const members = await db.member.findMany({
      where: { lodgeId: String(lodgeId), status: 'active', deceased: false },
      select: { id: true, name: true, email: true, phone: true },
    });
    return { meeting, lodge, members };
  });
  if (!setup) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });

  const { meeting, lodge, members } = setup;
  const lodgeChannels = buildLodgeChannels(lodge);
  const dataHora = meeting.date.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
  const subject = `Convocação: ${meeting.title}`;
  const text = [
    `Meus irmãos, fica convocada a sessão "${meeting.title}" da ${lodge?.name ?? 'loja'}.`,
    `Data e hora: ${dataHora}.`,
    meeting.agenda ? `Ordem do dia:\n${meeting.agenda}` : null,
    'Contamos com a presença de todos. Fraternalmente.',
  ].filter(Boolean).join('\n\n');

  // Etapa 2: laço de despacho, sem transação aberta. Cada MessageLog é
  // gravado na sua própria transação curta (RLS continua garantido).
  let dispatched = 0;
  for (const m of members) {
    for (const channel of channels) {
      const to = channel === 'email' ? (m.email ?? '') : (m.phone ?? '');
      if (!to) { stats.skipped++; continue; }
      if (dispatched > 0) await sleep(DISPATCH_THROTTLE_MS);
      dispatched++;
      const r = await dispatch(channel, to, subject, text, lodgeChannels);
      stats[r.status]++;
      await withTenant(String(lodgeId), (db) =>
        db.messageLog.create({
          data: { lodgeId: String(lodgeId), memberId: m.id, channel, title: subject, content: text, status: r.status, error: r.detail ?? null },
        }),
      );
    }
  }

  // Etapa 3 (transação curta): marca a sessão como convocada + auditoria.
  await withTenant(String(lodgeId), async (db) => {
    await db.session.update({ where: { id }, data: { convocationSentAt: new Date(), convocationSentById: session.user.id } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'session-convocacao', entityId: id, metadata: { channels, ...stats } });
  });

  return NextResponse.json({ ok: true, stats });
}
