import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import ComunicacaoClient from './ComunicacaoClient';

// Server Component: carrega histórico de mensagens + membros no servidor.
export default async function ComunicacaoPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const { items, members } = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        items: await db.messageLog.findMany({
          where: { lodgeId: String(lodgeId) },
          include: { member: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        members: await db.member.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      }))
    : { items: [], members: [] };

  const messages = items.map((m) => ({
    id: m.id,
    title: m.title,
    channel: m.channel,
    content: m.content,
    status: m.status,
    member: m.member ? { name: m.member.name } : null,
  }));

  return <ComunicacaoClient items={messages} members={members} />;
}
