import { invoiceOpenBalance } from '@/lib/charge-notice';
import {
  groupReminders, inReminderScope, overdueMoreThan, reminderHtml, reminderSubject, reminderText,
  type ReminderGroup, type ReminderItem, type ReminderScope,
} from '@/lib/charge-reminder';
import { isAsaasMode, paymentInstructions, portalPayUrl } from '@/lib/collection';
import { brl } from '@/lib/currency';
import { lateChargeConfig, lateChargeSentence, pixAmount } from '@/lib/late-charge';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { channelsAvailable, dispatch, type LodgeChannels, type SendResult } from '@/lib/messaging';
import { buildPixPayload } from '@/lib/pix';
import { CLOSED_INVOICE_STATUSES } from '@/lib/portal-invoice';
import { withTenant } from '@/lib/prisma';

// Lado servidor do lembrete de cobranças por e-mail (lote e cobrança única): lê a loja e as
// cobranças abertas, monta os itens (Pix por cobrança no Modo Loja; link do Asaas ou portal no
// Modo Asaas — nada é emitido no Asaas aqui, decisão do dono), envia e registra no MessageLog.
// O envio NUNCA fica dentro de uma transação (withTenant curto só para ler/gravar).

export interface ReminderContext {
  lodgeName: string;
  asaasMode: boolean;
  channels: LodgeChannels;
  emailReady: boolean;
  portalUrl: string | null;
  instructions: string | null;
  groups: ReminderGroup[];
}

export async function loadReminderContext(lodgeId: string, filter: { scope: ReminderScope; invoiceId?: string; minDaysOverdue?: number }, now: Date = new Date()): Promise<ReminderContext | null> {
  const data = await withTenant(lodgeId, async (db) => {
    const [lodge, invoices] = await Promise.all([
      db.lodge.findUnique({
        where: { id: lodgeId },
        select: {
          ...LODGE_MESSAGING_SELECT,
          tradeName: true, city: true, collectionMode: true, pixKey: true, bankName: true, bankAgency: true, bankAccount: true,
          chargeLateFeesOnPix: true, lateFeePercent: true, lateInterestPercentMonth: true,
        },
      }),
      db.invoice.findMany({
        where: { lodgeId, memberId: { not: null }, status: { notIn: CLOSED_INVOICE_STATUSES }, ...(filter.invoiceId ? { id: filter.invoiceId } : {}) },
        select: {
          id: true, number: true, amount: true, dueDate: true, status: true, description: true, asaasInvoiceUrl: true,
          member: { select: { id: true, name: true, email: true } },
          account: { select: { title: true, amount: true, status: true, payments: { select: { amount: true } } } },
        },
      }),
    ]);
    return { lodge, invoices };
  });
  const { lodge } = data;
  if (!lodge) return null;

  const asaasMode = isAsaasMode(lodge);
  const pixKey = lodge.pixKey?.trim() || null;
  // Multa e juros no Pix só existem no Modo Loja (no Asaas quem calcula é o Asaas).
  const lateCfg = lateChargeConfig(asaasMode ? null : lodge);

  const rows = data.invoices.flatMap((inv) => {
    if (!inv.member) return [];
    const balance = invoiceOpenBalance(inv.amount, inv.account);
    const base = { dueDate: inv.dueDate, status: inv.status, balance };
    if (!inReminderScope(base, filter.invoiceId ? 'all' : filter.scope, now)) return [];
    if (filter.minDaysOverdue != null && !overdueMoreThan(inv.dueDate, filter.minDaysOverdue, now)) return [];
    const pix = pixAmount(balance, inv.dueDate, lateCfg, now);
    const item: ReminderItem = {
      invoiceId: inv.id,
      number: inv.number,
      title: inv.account?.title ?? inv.description ?? '',
      ...base,
      payAmount: pix.total,
      lateSentence: lateChargeSentence(pix, brl),
      // Modo Loja: Pix estático da cobrança (txid = número), com o valor de hoje.
      pixCopyPaste: !asaasMode && pixKey
        ? buildPixPayload({ key: pixKey, name: lodge.tradeName || lodge.name || 'Loja', city: lodge.city, amount: pix.total, txid: inv.number })
        : null,
      payUrl: asaasMode ? inv.asaasInvoiceUrl ?? null : null,
    };
    return [{ member: { id: inv.member.id, name: inv.member.name, email: inv.member.email?.trim() || null }, item }];
  });

  const channels = buildLodgeChannels(lodge);
  return {
    lodgeName: lodge.tradeName || lodge.name || 'Loja',
    asaasMode,
    channels,
    emailReady: channelsAvailable(channels).email,
    // No Modo Loja o portal só gera o QR se a loja tem chave Pix (mesma regra do payHint).
    portalUrl: asaasMode || pixKey ? portalPayUrl() : null,
    instructions: asaasMode ? null : paymentInstructions(lodge),
    groups: groupReminders(rows),
  };
}

/** Envia o e-mail de um irmão e grava no MessageLog (conteúdo = texto puro). */
export async function sendReminder(lodgeId: string, ctx: ReminderContext, group: ReminderGroup, logTitle: string): Promise<SendResult> {
  const opts = { lodgeName: ctx.lodgeName, portalUrl: ctx.portalUrl, instructions: ctx.instructions };
  const text = reminderText(group, opts);
  const result = group.member.email
    ? await dispatch('email', group.member.email, reminderSubject(group, ctx.lodgeName), text, ctx.channels, { html: reminderHtml(group, opts) })
    : { status: 'failed' as const, detail: 'O irmão não tem e-mail cadastrado.' };
  await withTenant(lodgeId, (db) =>
    db.messageLog.create({ data: { lodgeId, memberId: group.member.id, channel: 'email', title: logTitle, content: text, status: result.status, error: result.detail ?? null } }),
  );
  return result;
}
