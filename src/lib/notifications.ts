import { prismaAdmin, withTenant } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { configuredChannels, dispatch, type Channel } from '@/lib/messaging';
import { TENURE_MILESTONES } from '@/lib/masonic-degree';

// Gatilhos automáticos diários (Fase 7): aniversariantes (obreiro + família),
// jubileus/aniversário de iniciação e lembretes de cobrança. Envia pelos canais
// configurados (lib/messaging) e registra tudo no MessageLog, com deduplicação
// por dia (não envia a mesma notificação duas vezes no mesmo dia).

const REMINDER_DAYS_AHEAD = 3; // cobranças que vencem nos próximos N dias

// Partes da data no fuso de São Paulo (o cron roda em UTC).
function partsBR(d: Date): { y: number; m: number; day: number } {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [{ value: y }, , { value: m }, , { value: day }] = f.formatToParts(d);
  return { y: Number(y), m: Number(m), day: Number(day) };
}
const sameDayMonth = (a: Date, ref: { m: number; day: number }) => {
  const p = partsBR(a);
  return p.m === ref.m && p.day === ref.day;
};
const brl = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

interface Stats { birthdays: number; relativesBirthdays: number; jubilees: number; dueSoon: number; overdue: number; sent: number; queued: number; failed: number; skipped: number }

export async function runDailyNotifications(): Promise<Stats> {
  const stats: Stats = { birthdays: 0, relativesBirthdays: 0, jubilees: 0, dueSoon: 0, overdue: 0, sent: 0, queued: 0, failed: 0, skipped: 0 };

  const channels = (Object.entries(configuredChannels()).filter(([, on]) => on).map(([c]) => c)) as Channel[];
  if (channels.length === 0) return stats; // nenhum canal ativo → nada a enviar

  const now = new Date();
  const today = partsBR(now);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const dueLimit = new Date(now.getTime() + REMINDER_DAYS_AHEAD * 24 * 3600 * 1000);

  // Envia uma vez por (membro, canal, título) por dia (dedup via MessageLog).
  async function notify(db: Prisma.TransactionClient, lodgeId: string, memberId: string | null, to: string, title: string, body: string) {
    for (const channel of channels) {
      const dest = to.trim();
      if (!dest) { stats.skipped++; continue; }
      const dup = await db.messageLog.findFirst({
        where: { lodgeId, memberId, channel, title, createdAt: { gte: startOfDay } },
        select: { id: true },
      });
      if (dup) { stats.skipped++; continue; }
      const r = await dispatch(channel, dest, title, body);
      stats[r.status]++;
      await db.messageLog.create({ data: { lodgeId, memberId, channel, title, content: body, status: r.status } });
    }
  }

  const lodges = await prismaAdmin.lodge.findMany({ select: { id: true, name: true } });

  for (const lodge of lodges) {
    await withTenant(lodge.id, async (db) => {
      const [members, invoices] = await Promise.all([
        db.member.findMany({
          where: { lodgeId: lodge.id, status: 'active' },
          select: {
            id: true, name: true, email: true, phone: true, birthDate: true, initiationDate: true,
            relatives: { select: { kind: true, name: true, birthDate: true, email: true, phone: true } },
          },
        }),
        db.invoice.findMany({
          where: { lodgeId: lodge.id, status: { in: ['pending', 'overdue'] } },
          select: { id: true, number: true, amount: true, dueDate: true, status: true, member: { select: { id: true, name: true, email: true, phone: true } } },
        }),
      ]);

      const channelTo = (channel: Channel, email?: string | null, phone?: string | null) => (channel === 'email' ? email : phone) ?? '';

      for (const m of members) {
        // 1) Aniversário do obreiro
        if (m.birthDate && sameDayMonth(m.birthDate, today)) {
          stats.birthdays++;
          const to = channelTo(channels[0], m.email, m.phone);
          await notify(db, lodge.id, m.id, channelTo('email', m.email, m.phone) || to,
            'Feliz aniversário',
            `Caro irmão ${m.name}, a ${lodge.name} deseja a você um feliz aniversário! Que a luz e a saúde o acompanhem. Fraternalmente.`);
        }

        // 2) Aniversário de familiares (mensagem ao próprio familiar, se tiver contato)
        for (const r of m.relatives) {
          if (r.birthDate && sameDayMonth(r.birthDate, today) && (r.email || r.phone)) {
            stats.relativesBirthdays++;
            await notify(db, lodge.id, m.id, (r.email || r.phone) as string,
              `Aniversário de familiar: ${r.name}`,
              `Olá ${r.name}, a ${lodge.name}, por meio da Hospitalaria, deseja um feliz aniversário! Com carinho e fraternidade.`);
          }
        }

        // 3) Jubileu / aniversário de iniciação (marcos de Tempo de Ordem)
        if (m.initiationDate && sameDayMonth(m.initiationDate, today)) {
          const years = today.y - partsBR(m.initiationDate).y;
          if (TENURE_MILESTONES.includes(years)) {
            stats.jubilees++;
            await notify(db, lodge.id, m.id, channelTo('email', m.email, m.phone),
              `Jubileu maçônico: ${years} anos`,
              `Caro irmão ${m.name}, a ${lodge.name} celebra com alegria os seus ${years} anos de iniciação na Ordem. Parabéns por essa caminhada! Fraternalmente.`);
          }
        }
      }

      // 4) Cobranças a vencer e vencidas
      for (const inv of invoices) {
        if (!inv.member) continue;
        const to = inv.member.email || inv.member.phone;
        if (!to) continue;
        const overdue = inv.dueDate < startOfDay || inv.status === 'overdue';
        const dueSoon = !overdue && inv.dueDate <= dueLimit;
        if (!overdue && !dueSoon) continue;
        if (overdue) {
          stats.overdue++;
          await notify(db, lodge.id, inv.member.id, to, 'Aviso de cobrança vencida',
            `Caro irmão ${inv.member.name}, consta a cobrança ${inv.number} no valor de ${brl(inv.amount)}, vencida em ${fmtDate(inv.dueDate)}. Por gentileza, regularize. Fraternalmente, Tesouraria.`);
        } else {
          stats.dueSoon++;
          await notify(db, lodge.id, inv.member.id, to, 'Lembrete de cobrança a vencer',
            `Caro irmão ${inv.member.name}, lembramos a cobrança ${inv.number} no valor de ${brl(inv.amount)}, com vencimento em ${fmtDate(inv.dueDate)}. Fraternalmente, Tesouraria.`);
        }
      }
    });
  }

  return stats;
}
