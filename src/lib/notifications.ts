import { prismaAdmin, withTenant } from '@/lib/prisma';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { channelsAvailable, dispatch, sleep, DISPATCH_THROTTLE_MS, type Channel, type LodgeChannels } from '@/lib/messaging';
import { TENURE_MILESTONES } from '@/lib/masonic-degree';
import { isAnniversaryToday, todayBR, yearsCompleted } from '@/lib/anniversary';
import { AUTO_REMINDER_LOG_TITLE, AUTO_REMINDER_MIN_DAYS_OVERDUE, autoReminderWindowStart, reminderHtml, reminderShortText, reminderText } from '@/lib/charge-reminder';
import { loadReminderContext } from '@/lib/charge-reminder-server';

// Gatilhos automáticos diários (Fase 7): aniversariantes (obreiro + família),
// jubileus (iniciação/elevação/exaltação — tempo de mestre) e lembretes de
// cobrança (só vencidas há mais de 30 dias, um aviso por irmão — lib/charge-reminder). Envia pelos canais disponíveis em cada loja (e-mail pela
// plataforma; WhatsApp/SMS BYO por loja) e registra tudo no MessageLog,
// deduplicado por dia. Cada categoria liga/desliga por loja (Lodge.notify*).
// Membro/familiar marcado como falecido nunca recebe felicitação de
// aniversário/jubileu — ver Configurações da loja e cadastro do membro.

// Marcos de evolução maçônica que geram jubileu (nome do campo de data no
// Member, e como nomear o marco na mensagem). Exaltação = 3º grau = Mestre
// Maçom, por isso cobre "tempo de mestre" pedido pelo usuário.
const DEGREE_MILESTONES: { field: 'initiationDate' | 'elevationDate' | 'exaltationDate'; label: string }[] = [
  { field: 'initiationDate', label: 'iniciação' },
  { field: 'elevationDate', label: 'elevação' },
  { field: 'exaltationDate', label: 'exaltação (Mestre Maçom)' },
];

interface Stats { birthdays: number; relativesBirthdays: number; jubilees: number; foundationAnniversaries: number; overdue: number; sent: number; queued: number; failed: number; skipped: number }

export async function runDailyNotifications(): Promise<Stats> {
  const stats: Stats = { birthdays: 0, relativesBirthdays: 0, jubilees: 0, foundationAnniversaries: 0, overdue: 0, sent: 0, queued: 0, failed: 0, skipped: 0 };

  const now = new Date();
  const today = todayBR(now);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  // Envia uma vez por (membro, canal, título) por dia (dedup via MessageLog).
  // `dispatched` é compartilhado por TODAS as chamadas de notify() no cron —
  // o cron roda todas as lojas e todos os membros numa só execução, então a
  // pausa entre disparos precisa valer pro lote inteiro, não só por membro.
  // Cada leitura/escrita usa sua própria transação curta (withTenant) — nunca
  // envolvendo o dispatch()/sleep() dentro de uma transação, porque uma
  // transação interativa do Prisma expira em 5s por padrão e o lote do cron
  // (todas as lojas, todos os membros) passa disso fácil (visto em produção
  // num caso análogo: convocação de sessão com dezenas de membros).
  let dispatched = 0;
  async function notify(lodgeId: string, list: Channel[], ch: LodgeChannels, memberId: string | null, to: string, title: string, body: string, html?: string) {
    for (const channel of list) {
      const dest = to.trim();
      if (!dest) { stats.skipped++; continue; }
      const dup = await withTenant(lodgeId, (db) =>
        db.messageLog.findFirst({ where: { lodgeId, memberId, channel, title, createdAt: { gte: startOfDay } }, select: { id: true } }),
      );
      if (dup) { stats.skipped++; continue; }
      if (dispatched > 0) await sleep(DISPATCH_THROTTLE_MS);
      dispatched++;
      const r = await dispatch(channel, dest, title, body, ch, html ? { html } : undefined);
      stats[r.status]++;
      await withTenant(lodgeId, (db) =>
        db.messageLog.create({ data: { lodgeId, memberId, channel, title, content: body, status: r.status, error: r.detail ?? null } }),
      );
    }
  }

  const lodges = await prismaAdmin.lodge.findMany({
    select: {
      id: true, ...LODGE_MESSAGING_SELECT,
      foundationDate: true,
      notifyBirthdaysEnabled: true, notifyMilestonesEnabled: true, notifyBillingRemindersEnabled: true,
      notifyFoundationAnniversaryEnabled: true,
    },
  });

  for (const lodge of lodges) {
    const lodgeChannels = buildLodgeChannels(lodge);
    const avail = channelsAvailable(lodgeChannels);
    const list = (Object.entries(avail).filter(([, on]) => on).map(([c]) => c)) as Channel[];
    if (list.length === 0) continue; // loja sem nenhum canal ativo

    // Transação curta: só leitura. notify() (chamada abaixo, já fora da
    // transação) faz suas próprias transações curtas por escrita.
    const members = await withTenant(lodge.id, (db) =>
      db.member.findMany({
        where: { lodgeId: lodge.id, status: 'active', deceased: false },
        select: {
          id: true, name: true, email: true, phone: true, birthDate: true,
          initiationDate: true, elevationDate: true, exaltationDate: true,
          relatives: { select: { kind: true, name: true, birthDate: true, email: true, phone: true, deceased: true } },
        },
      }),
    );

    const contactFor = (channel: Channel, email?: string | null, phone?: string | null) => (channel === 'email' ? email : phone) ?? '';

    for (const m of members) {
      // 1) Aniversário do obreiro
      if (lodge.notifyBirthdaysEnabled && m.birthDate && isAnniversaryToday(m.birthDate, today)) {
        stats.birthdays++;
        for (const channel of list) {
          await notify(lodge.id, [channel], lodgeChannels, m.id, contactFor(channel, m.email, m.phone),
            'Feliz aniversário',
            `Caro irmão ${m.name}, a ${lodge.name} deseja a você um feliz aniversário! Que a luz e a saúde o acompanhem. Fraternalmente.`);
        }
      }

      // 2) Aniversário de familiares (ao próprio familiar, se tiver contato) —
      // pula quem está marcado como falecido.
      if (lodge.notifyBirthdaysEnabled) {
        for (const r of m.relatives) {
          if (r.deceased) continue;
          if (r.birthDate && isAnniversaryToday(r.birthDate, today) && (r.email || r.phone)) {
            stats.relativesBirthdays++;
            for (const channel of list) {
              const to = contactFor(channel, r.email, r.phone);
              if (!to) continue;
              await notify(lodge.id, [channel], lodgeChannels, m.id, to,
                `Aniversário de familiar: ${r.name}`,
                `Olá ${r.name}, a ${lodge.name}, por meio da Hospitalaria, deseja um feliz aniversário! Com carinho e fraternidade.`);
            }
          }
        }
      }

      // 3) Jubileu: iniciação, elevação ou exaltação (tempo de mestre)
      if (lodge.notifyMilestonesEnabled) {
        for (const milestone of DEGREE_MILESTONES) {
          const d = m[milestone.field];
          if (!d || !isAnniversaryToday(d, today)) continue;
          const years = yearsCompleted(d, today);
          if (!TENURE_MILESTONES.includes(years)) continue;
          stats.jubilees++;
          for (const channel of list) {
            await notify(lodge.id, [channel], lodgeChannels, m.id, contactFor(channel, m.email, m.phone),
              `Jubileu maçônico: ${years} anos de ${milestone.label}`,
              `Caro irmão ${m.name}, a ${lodge.name} celebra com alegria os seus ${years} anos de ${milestone.label} na Ordem. Parabéns por essa caminhada! Fraternalmente.`);
          }
        }
      }
    }

    // 4) Aniversário de fundação da loja — mensagem a todos os obreiros ativos
    if (lodge.notifyFoundationAnniversaryEnabled && lodge.foundationDate && isAnniversaryToday(lodge.foundationDate, today)) {
      const years = yearsCompleted(lodge.foundationDate, today);
      for (const m of members) {
        stats.foundationAnniversaries++;
        for (const channel of list) {
          await notify(lodge.id, [channel], lodgeChannels, m.id, contactFor(channel, m.email, m.phone),
            `Aniversário de fundação da loja: ${years} anos`,
            `Caro irmão ${m.name}, hoje a ${lodge.name} celebra ${years} anos de fundação! Um marco na nossa história de trabalho e fraternidade. Parabéns a todos nós. Fraternalmente.`);
        }
      }
    }

    // 5) Cobranças vencidas há mais de 30 dias: UM aviso por irmão com todas elas (e-mail com um
    // bloco pagável por cobrança; WhatsApp/SMS com o resumo), no máximo um a cada 7 dias por irmão.
    if (lodge.notifyBillingRemindersEnabled) {
      const ctx = await loadReminderContext(lodge.id, { scope: 'overdue', minDaysOverdue: AUTO_REMINDER_MIN_DAYS_OVERDUE }, now);
      if (ctx) {
        const opts = { lodgeName: ctx.lodgeName, portalUrl: ctx.portalUrl, instructions: ctx.instructions };
        const phones = new Map(members.map((m) => [m.id, m.phone]));
        // Quem recebeu o aviso nos últimos 7 dias (por qualquer canal) espera a próxima semana.
        const recent = new Set((await withTenant(lodge.id, (db) => db.messageLog.findMany({
          where: { lodgeId: lodge.id, title: AUTO_REMINDER_LOG_TITLE, status: 'sent', createdAt: { gte: autoReminderWindowStart(now) } },
          select: { memberId: true },
        }))).map((l) => l.memberId));
        for (const group of ctx.groups) {
          if (recent.has(group.member.id)) { stats.skipped++; continue; }
          stats.overdue += group.items.length;
          for (const channel of list) {
            if (channel === 'email') {
              await notify(lodge.id, [channel], lodgeChannels, group.member.id, group.member.email ?? '', AUTO_REMINDER_LOG_TITLE, reminderText(group, opts), reminderHtml(group, opts));
            } else {
              await notify(lodge.id, [channel], lodgeChannels, group.member.id, phones.get(group.member.id) ?? '', AUTO_REMINDER_LOG_TITLE, reminderShortText(group, opts));
            }
          }
        }
      }
    }
  }

  return stats;
}
