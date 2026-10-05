import { isAsaasMode, paymentInstructions, portalPayUrl } from '@/lib/collection';
import { lateChargeConfig } from '@/lib/late-charge';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { channelsAvailable, dispatch, type LodgeChannels, type SendResult } from '@/lib/messaging';
import { getLodgeOverdueDuesReport, isArt002Enabled } from '@/lib/overdue';
import {
  canReceiveOverdueNotice, OVERDUE_NOTICE_LOG_TITLE, overdueNoticeHtml, overdueNoticeRef, overdueNoticeSubject, overdueNoticeText,
  overdueNoticeWindowStart, overdueNoticeWhatsApp, type OverdueNoticeInput,
} from '@/lib/overdue-notice';
import { withTenant } from '@/lib/prisma';
import { normalizeWhatsAppPhone } from '@/lib/whatsapp-link';

// Lado servidor do aviso de inadimplência (relatório Inadimplência — Art. 002). Os números (cobranças, total,
// dias) são SEMPRE recalculados aqui a partir do banco — nunca vêm da tela. O envio fica fora de transação.

export interface OverdueNoticeMember {
  memberId: string;
  name: string;
  email: string | null;
  phone: string | null;
  rawPhone: string | null;
  input: OverdueNoticeInput;
  /** Recebeu um aviso (qualquer canal) nos últimos 7 dias — o envio em lote pula. */
  sentRecently: boolean;
  lastSentAt: string | null;
}

export interface OverdueNoticeContext {
  lodgeName: string;
  channels: LodgeChannels;
  emailReady: boolean;
  members: OverdueNoticeMember[];
  /** Pedidos que ficaram de fora por não estarem ativos (bloqueados, afastados…) ou não estarem mais em atraso. */
  leftOut: number;
}

export async function loadOverdueNotices(lodgeId: string, memberIds: string[] | null, now: Date = new Date()): Promise<OverdueNoticeContext | null> {
  const data = await withTenant(lodgeId, async (db) => {
    const [lodge, rows, logs] = await Promise.all([
      db.lodge.findUnique({
        where: { id: lodgeId },
        select: {
          ...LODGE_MESSAGING_SELECT,
          tradeName: true, collectionMode: true, pixKey: true, bankName: true, bankAgency: true, bankAccount: true,
          art002Enabled: true, lateFeePercent: true, lateInterestPercentMonth: true, chargeLateFeesOnPix: true,
        },
      }),
      getLodgeOverdueDuesReport(db, lodgeId, now),
      db.messageLog.findMany({
        where: { lodgeId, ref: { startsWith: 'overdue-notice:' }, status: 'sent', createdAt: { gte: overdueNoticeWindowStart(now) } },
        select: { memberId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const wanted = memberIds ? new Set(memberIds) : null;
    const ids = rows.filter((r) => !wanted || wanted.has(r.memberId)).map((r) => r.memberId);
    const people = ids.length
      ? await db.member.findMany({ where: { lodgeId, id: { in: ids } }, select: { id: true, name: true, email: true, phone: true, status: true, deceased: true } })
      : [];
    return { lodge, rows, logs, people, wanted };
  });
  if (!data.lodge) return null;
  const { lodge, rows, logs, people, wanted } = data;

  const asaasMode = isAsaasMode(lodge);
  const pixKey = lodge.pixKey?.trim() || null;
  const portalUrl = asaasMode || pixKey ? portalPayUrl() : null;
  const instructions = asaasMode ? null : paymentInstructions(lodge);
  const lateCfg = lateChargeConfig(lodge);
  const hasLateFees = Boolean(lateCfg.feePercent || lateCfg.interestPercentMonth);
  const lodgeName = lodge.tradeName || lodge.name || 'Loja';
  const lastSent = new Map<string, Date>();
  for (const l of logs) if (l.memberId && !lastSent.has(l.memberId)) lastSent.set(l.memberId, l.createdAt);
  const personById = new Map(people.map((p) => [p.id, p]));
  const rowById = new Map(rows.map((r) => [r.memberId, r]));

  const members: OverdueNoticeMember[] = [];
  for (const [id, row] of rowById) {
    if (wanted && !wanted.has(id)) continue;
    const person = personById.get(id);
    if (!person || !canReceiveOverdueNotice(person)) continue;
    const last = lastSent.get(id);
    members.push({
      memberId: id,
      name: person.name,
      email: person.email?.trim() || null,
      phone: normalizeWhatsAppPhone(person.phone),
      rawPhone: person.phone,
      sentRecently: Boolean(last),
      lastSentAt: last?.toISOString() ?? null,
      input: {
        memberName: person.name, lodgeName, count: row.openCount, total: row.totalAmount, oldestDueDate: row.oldestDueDate, daysOverdue: row.daysOverdue,
        art002Enabled: isArt002Enabled(lodge), hasLateFees, portalUrl, instructions,
      },
    });
  }
  members.sort((a, b) => b.input.daysOverdue - a.input.daysOverdue || a.name.localeCompare(b.name, 'pt-BR'));

  const channels = buildLodgeChannels(lodge);
  return {
    lodgeName,
    channels,
    emailReady: channelsAvailable(channels).email,
    members,
    leftOut: wanted ? wanted.size - members.length : 0,
  };
}

/** Texto do WhatsApp do irmão (a partir do contexto já carregado). */
export const noticeWhatsAppText = (m: OverdueNoticeMember) => overdueNoticeWhatsApp(m.input);

/** Envia o e-mail de um irmão e grava no MessageLog (conteúdo = texto puro; ref evita reenvio em 7 dias). */
export async function sendOverdueNoticeEmail(lodgeId: string, ctx: OverdueNoticeContext, m: OverdueNoticeMember): Promise<SendResult> {
  const text = overdueNoticeText(m.input);
  const result = m.email
    ? await dispatch('email', m.email, overdueNoticeSubject(ctx.lodgeName), text, ctx.channels, { html: overdueNoticeHtml(m.input) })
    : { status: 'failed' as const, detail: 'O irmão não tem e-mail cadastrado.' };
  await withTenant(lodgeId, (db) =>
    db.messageLog.create({ data: { lodgeId, memberId: m.memberId, channel: 'email', title: OVERDUE_NOTICE_LOG_TITLE, content: text, status: result.status, error: result.detail ?? null, ref: overdueNoticeRef(m.memberId) } }),
  );
  return result;
}
