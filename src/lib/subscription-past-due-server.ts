// Assinatura da plataforma com pagamento em atraso (cartão recusado). A loja tem 30 dias de tolerância
// (lib/subscription-access.ts): segue funcionando, a Diretoria (Administrador, Venerável e Tesoureiro) recebe e-mail
// no início do atraso e lembretes, e vê um aviso na tela. Passados os 30 dias, a loja cai na tela de escolha do plano.
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { PAST_DUE_GRACE_DAYS } from '@/lib/subscription-access';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Dias de atraso em que a Diretoria recebe um lembrete (além do aviso do primeiro dia). */
export const PAST_DUE_REMINDER_DAYS = [7, 15, 25];

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br').replace(/\/+$/, '');
const fmtDay = (d: Date) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(d);

/** Texto do aviso. `elapsed` = dias desde o início do atraso (0 no primeiro aviso). */
export function pastDueMessage(lodgeName: string, since: Date, elapsed: number): { subject: string; body: string } {
  const endsAt = new Date(since.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS);
  const left = Math.max(1, PAST_DUE_GRACE_DAYS - elapsed);
  const subject = elapsed === 0
    ? `Pagamento da assinatura não foi aprovado — ${lodgeName}`
    : `Assinatura em atraso: faltam ${left} ${left === 1 ? 'dia' : 'dias'} para o bloqueio — ${lodgeName}`;
  const body = [
    `A cobrança da assinatura do Sigma Horus da loja ${lodgeName} não foi aprovada${elapsed === 0 ? '' : ` e segue em aberto há ${elapsed} ${elapsed === 1 ? 'dia' : 'dias'}`}.`,
    '',
    `O sistema continua funcionando normalmente até ${fmtDay(endsAt)}. Depois dessa data, sem a regularização, o acesso da loja será bloqueado e todos os usuários verão apenas a tela de escolha do plano.`,
    '',
    `Para regularizar, entre em Assinatura e atualize o cartão: ${appUrl()}/dashboard/assinatura`,
    '',
    'Este aviso é enviado só ao Administrador, ao Venerável e ao Tesoureiro.',
  ].join('\n');
  return { subject, body };
}

/** Envia o aviso uma única vez por atraso e por marco (`ref`); falha de envio nunca derruba o webhook. */
async function sendNotice(lodgeId: string, since: Date, elapsed: number, tag: string): Promise<number> {
  const ref = `sub-past-due:${since.toISOString()}:${tag}`;
  const ctx = await withTenant(lodgeId, async (db) => {
    if (await db.messageLog.findFirst({ where: { lodgeId, ref }, select: { id: true } })) return null;
    const [lodge, staff] = await Promise.all([
      db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true } }),
      db.user.findMany({ where: { lodgeId, role: { in: ['treasurer', 'venerable', 'admin'] }, status: 'active' }, select: { email: true } }),
    ]);
    const msg = pastDueMessage(lodge?.name ?? 'sua loja', since, elapsed);
    await db.messageLog.create({ data: { lodgeId, channel: 'email', title: msg.subject, content: msg.body, status: 'sent', ref } });
    return { staff, msg };
  });
  if (!ctx) return 0;
  let sent = 0;
  for (const to of new Set(ctx.staff.map((u) => u.email).filter(Boolean))) {
    const r = await dispatch('email', to, ctx.msg.subject, ctx.msg.body, EMPTY_CHANNELS).catch(() => null);
    if (r?.status === 'sent') sent++;
  }
  return sent;
}

/** Cobrança recusada: marca o início do atraso (só na primeira vez) e avisa a Diretoria. */
export async function markPastDue(lodgeId: string, stripeSubscriptionId: string): Promise<void> {
  const current = await prismaAdmin.subscription.findUnique({ where: { lodgeId }, select: { status: true, pastDueSince: true, stripeSubscriptionId: true } });
  if (!current) return;
  // Evento de uma assinatura antiga da loja não pode colocar a vigente em atraso.
  if (current.stripeSubscriptionId && current.stripeSubscriptionId !== stripeSubscriptionId) return;
  let since = current.pastDueSince;
  if (current.status !== 'past_due' || !since) {
    since = since ?? new Date();
    await prismaAdmin.subscription.update({ where: { lodgeId }, data: { status: 'past_due', pastDueSince: since } });
  }
  await sendNotice(lodgeId, since, 0, 'start').catch((err) => console.error('assinatura em atraso: falha ao avisar a Diretoria', { lodgeId, err }));
}

/** Cron diário: lembretes nos dias 7, 15 e 25 do atraso. */
export async function alertPastDueReminders(): Promise<{ checked: number; emails: number }> {
  const subs = await prismaAdmin.subscription.findMany({ where: { status: 'past_due', pastDueSince: { not: null } }, select: { lodgeId: true, pastDueSince: true } });
  const stats = { checked: subs.length, emails: 0 };
  const now = Date.now();
  for (const s of subs) {
    const since = s.pastDueSince!;
    const elapsed = Math.floor((now - since.getTime()) / DAY_MS);
    const milestone = [...PAST_DUE_REMINDER_DAYS].reverse().find((d) => elapsed >= d);
    if (milestone === undefined || elapsed >= PAST_DUE_GRACE_DAYS) continue;
    stats.emails += await sendNotice(s.lodgeId, since, elapsed, `d${milestone}`).catch((err) => {
      console.error('assinatura em atraso: falha no lembrete', { lodgeId: s.lodgeId, err });
      return 0;
    });
  }
  return stats;
}
