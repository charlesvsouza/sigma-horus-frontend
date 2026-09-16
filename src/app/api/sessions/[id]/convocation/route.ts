import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { dispatch, type Channel } from '@/lib/messaging';
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

  const result = await withTenant(String(lodgeId), async (db) => {
    const meeting = await db.session.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!meeting) return { error: 'not_found' as const };

    const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { ...LODGE_MESSAGING_SELECT } });
    const lodgeChannels = buildLodgeChannels(lodge);

    const members = await db.member.findMany({
      where: { lodgeId: String(lodgeId), status: 'active', deceased: false },
      select: { id: true, name: true, email: true, phone: true },
    });

    const dataHora = meeting.date.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
    const subject = `Convocação: ${meeting.title}`;
    const text = [
      `Meus irmãos, fica convocada a sessão "${meeting.title}" da ${lodge?.name ?? 'loja'}.`,
      `Data e hora: ${dataHora}.`,
      meeting.agenda ? `Ordem do dia:\n${meeting.agenda}` : null,
      'Contamos com a presença de todos. Fraternalmente.',
    ].filter(Boolean).join('\n\n');

    for (const m of members) {
      for (const channel of channels) {
        const to = channel === 'email' ? (m.email ?? '') : (m.phone ?? '');
        if (!to) { stats.skipped++; continue; }
        const r = await dispatch(channel, to, subject, text, lodgeChannels);
        stats[r.status]++;
        await db.messageLog.create({
          data: { lodgeId: String(lodgeId), memberId: m.id, channel, title: subject, content: text, status: r.status },
        });
      }
    }

    await db.session.update({ where: { id }, data: { convocationSentAt: new Date(), convocationSentById: session.user.id } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'session-convocacao', entityId: id, metadata: { channels, ...stats } });
    return { ok: true as const };
  });

  if (result && 'error' in result) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
  return NextResponse.json({ ok: true, stats });
}
