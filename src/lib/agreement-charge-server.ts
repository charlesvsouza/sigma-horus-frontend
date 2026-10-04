import QRCode from 'qrcode';
import type { Prisma } from '@/generated/prisma/client';
import {
  agreementChargeMessage, agreementChargeSubject, agreementLogTitle, agreementMessageRef, agreementTxid, balanceCharge, chargeableParcels,
  pickCharge, sendMarksByTarget, AGREEMENT_WHATSAPP_CHANNEL, AGREEMENT_MESSAGE_REF_PREFIX, AGREEMENT_NOTICE_COOLDOWN_MS, AGREEMENT_NOTICE_ENTITY, type ChargeTarget, type ParcelCharge,
} from '@/lib/agreement-charge';
import { logAudit } from '@/lib/audit';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { paymentInstructions } from '@/lib/collection';
import { todayBR } from '@/lib/date-only';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { agreementKindLabel } from '@/lib/member-block';
import { summarizeBlock, type BlockSummary } from '@/lib/member-block-server';
import { dispatch } from '@/lib/messaging';
import { buildPixPayload } from '@/lib/pix';
import { withTenant } from '@/lib/prisma';
import { normalizeWhatsAppPhone } from '@/lib/whatsapp-link';

type Db = Prisma.TransactionClient;
type Fail = { ok: false; status: number; error: string };

export interface PreparedCharge {
  ok: true;
  blockId: string;
  kind: string;
  installments: number;
  memberId: string;
  memberName: string;
  phone: string | null;
  rawPhone: string | null;
  email: string | null;
  charge: ParcelCharge;
  txid: string;
  pixCopyPaste: string;
  qrDataUrl: string;
  text: string;
  subject: string;
  summary: BlockSummary;
}

const asBlock = (s: BlockSummary) => ({ id: s.id, kind: s.kind, total: s.total, installments: s.installments, firstDueDate: s.firstDueDate, paid: s.paid, remaining: s.remaining });

/**
 * Monta a cobrança de uma parcela (ou do saldo) do acordo em aberto do irmão: Pix da chave da loja com o
 * valor exato, QR e a mensagem pronta. Vale em qualquer modo de recebimento — o acordo é sempre pelo Pix da loja.
 */
export async function prepareAgreementCharge(lodgeId: string, memberId: string, target: ChargeTarget, now: Date = new Date()): Promise<PreparedCharge | Fail> {
  const ctx = await withTenant(lodgeId, async (db) => {
    const block = await db.memberBlock.findFirst({ where: { lodgeId, memberId, status: 'open' }, include: { items: true } });
    if (!block) return null;
    const [summary, member, lodge] = await Promise.all([
      summarizeBlock(db, block, now),
      db.member.findFirst({ where: { id: memberId, lodgeId }, select: { name: true, phone: true, email: true } }),
      db.lodge.findUnique({ where: { id: lodgeId }, select: { tradeName: true, city: true, pixKey: true, bankName: true, bankAgency: true, bankAccount: true, ...LODGE_MESSAGING_SELECT } }),
    ]);
    return { summary, member, lodge };
  });
  if (!ctx || !ctx.member || !ctx.lodge) return { ok: false, status: 404, error: 'Não há acordo em aberto para este irmão.' };
  const { summary, member, lodge } = ctx;
  if (!lodge.pixKey?.trim()) {
    return { ok: false, status: 409, error: 'A loja ainda não cadastrou a chave Pix. Cadastre em Configurações da loja (dados bancários) para gerar a cobrança do acordo.' };
  }
  const charge = pickCharge(asBlock(summary), target, todayBR(now));
  if (!charge) return { ok: false, status: 409, error: target === 'balance' ? 'O acordo já está quitado.' : 'Esta parcela já está coberta pelo que foi pago.' };

  const txid = agreementTxid(summary.id, charge.target, charge.amount);
  const pixCopyPaste = buildPixPayload({ key: lodge.pixKey, name: lodge.tradeName || lodge.name || 'Loja', city: lodge.city, amount: charge.amount, txid });
  const qrDataUrl = await QRCode.toDataURL(pixCopyPaste, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
  const instructions = paymentInstructions(lodge);
  const text = agreementChargeMessage({ memberName: member.name, kind: summary.kind, charge, installments: summary.installments, pixCopyPaste, instructions });
  return {
    ok: true, blockId: summary.id, kind: summary.kind, installments: summary.installments, memberId, memberName: member.name,
    phone: normalizeWhatsAppPhone(member.phone), rawPhone: member.phone ?? null, email: member.email ?? null,
    charge, txid, pixCopyPaste, qrDataUrl, text, subject: agreementChargeSubject(summary.kind, charge, summary.installments), summary,
  };
}

/** WhatsApp (wa.me): registra que a conversa foi aberta; quem envia é a pessoa da Tesouraria. */
export async function recordAgreementWhatsAppHandoff(lodgeId: string, prepared: PreparedCharge, text: string): Promise<string> {
  const log = await withTenant(lodgeId, (db) => db.messageLog.create({
    select: { id: true },
    data: {
      lodgeId, memberId: prepared.memberId, channel: AGREEMENT_WHATSAPP_CHANNEL, status: 'handed-off',
      title: agreementLogTitle('whatsapp', prepared.charge, prepared.installments), content: text.slice(0, 4000),
      ref: agreementMessageRef(prepared.blockId, prepared.charge.target),
    },
  }));
  return log.id;
}

/** Confirmação de quem enviou ao voltar: "sim" → enviada; "não" → apaga o registro (nada saiu). */
export async function confirmAgreementWhatsApp(lodgeId: string, memberId: string, logId: string, sent: boolean): Promise<boolean> {
  return withTenant(lodgeId, async (db) => {
    const log = await db.messageLog.findFirst({
      where: { id: logId, lodgeId, memberId, channel: AGREEMENT_WHATSAPP_CHANNEL, status: 'handed-off', ref: { startsWith: AGREEMENT_MESSAGE_REF_PREFIX } },
      select: { id: true },
    });
    if (!log) return false;
    if (sent) await db.messageLog.update({ where: { id: log.id }, data: { status: 'sent' } });
    else await db.messageLog.delete({ where: { id: log.id } });
    return true;
  });
}

/** E-mail do acordo: texto + QR em anexo; o resultado fica no MessageLog. */
export async function sendAgreementEmail(lodgeId: string, prepared: PreparedCharge): Promise<{ ok: boolean; status: string; detail?: string }> {
  if (!prepared.email) return { ok: false, status: 'failed', detail: 'O irmão não tem e-mail cadastrado.' };
  const lodge = await withTenant(lodgeId, (db) => db.lodge.findUnique({ where: { id: lodgeId }, select: LODGE_MESSAGING_SELECT }));
  const png = prepared.qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const result = await dispatch('email', prepared.email, prepared.subject, prepared.text, buildLodgeChannels(lodge), { attachments: [{ filename: 'pix-acordo.png', content: png }] });
  await withTenant(lodgeId, (db) => db.messageLog.create({
    data: {
      lodgeId, memberId: prepared.memberId, channel: 'email', status: result.status, error: result.detail ?? null,
      title: agreementLogTitle('email', prepared.charge, prepared.installments), content: prepared.text,
      ref: agreementMessageRef(prepared.blockId, prepared.charge.target),
    },
  }));
  return { ok: result.status === 'sent', status: result.status, detail: result.detail };
}

// ── Visão para as telas ──────────────────────────────────────────────────────

export interface ChargeRow {
  /** "1", "2"… ou "balance". */
  target: string;
  number: number;
  amount: number;
  dueDate: string;
  late: boolean;
  sentAt: string | null;
  openedAt: string | null;
  emailedAt: string | null;
  /** Último "Já paguei" do irmão para este alvo. */
  noticeAt: string | null;
}

/** Cobranças possíveis de um acordo em aberto (parcelas + saldo) com a marca dos envios já feitos. */
export async function agreementChargeRows(db: Db, lodgeId: string, summary: BlockSummary, now: Date = new Date()): Promise<ChargeRow[]> {
  if (summary.status !== 'open') return [];
  const logs = await db.messageLog.findMany({
    where: { lodgeId, ref: { startsWith: `${AGREEMENT_MESSAGE_REF_PREFIX}${summary.id}:` } },
    select: { ref: true, channel: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const marks = sendMarksByTarget(logs, summary.id);
  const notices = await latestNotices(db, lodgeId, summary.id);
  const today = todayBR(now);
  const block = asBlock(summary);
  const list: ParcelCharge[] = chargeableParcels(block, today);
  const balance = balanceCharge(block, today);
  if (balance && list.length > 1) list.push(balance);
  return list.map((c) => {
    const key = String(c.target);
    const m = marks.get(key);
    return {
      target: key, number: c.number, amount: c.amount, dueDate: c.dueDate.toISOString(), late: c.late,
      sentAt: m?.sentAt?.toISOString() ?? null, openedAt: m?.openedAt?.toISOString() ?? null, emailedAt: m?.emailedAt?.toISOString() ?? null,
      noticeAt: notices.get(key)?.toISOString() ?? null,
    };
  });
}

/** Último "Já paguei" do irmão por alvo (parcela ou saldo) de um acordo. */
async function latestNotices(db: Db, lodgeId: string, blockId: string): Promise<Map<string, Date>> {
  const rows = await db.auditLog.findMany({
    where: { lodgeId, entity: AGREEMENT_NOTICE_ENTITY, entityId: blockId },
    select: { after: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const out = new Map<string, Date>();
  for (const r of rows) {
    let target: string | null = null;
    try { target = String((JSON.parse(r.after ?? '{}') as { target?: unknown }).target ?? ''); } catch { target = null; }
    if (target && !out.has(target)) out.set(target, r.createdAt);
  }
  return out;
}

export interface PortalAgreement {
  id: string;
  kind: string;
  kindLabel: string;
  total: number;
  paid: number;
  remaining: number;
  installments: number;
  hasPixKey: boolean;
  charges: { target: string; number: number; amount: number; dueDate: string; late: boolean; noticeAt: string | null }[];
}

/** "Meu acordo" do portal: só o que o irmão precisa ver (sem contato nem registros internos da Tesouraria). */
export async function portalAgreementView(db: Db, lodgeId: string, memberId: string, now: Date = new Date()): Promise<PortalAgreement | null> {
  const block = await db.memberBlock.findFirst({ where: { lodgeId, memberId, status: 'open' }, include: { items: true } });
  if (!block) return null;
  const [summary, lodge] = await Promise.all([summarizeBlock(db, block, now), db.lodge.findUnique({ where: { id: lodgeId }, select: { pixKey: true } })]);
  const rows = await agreementChargeRows(db, lodgeId, summary, now);
  return {
    id: summary.id, kind: summary.kind, kindLabel: agreementKindLabel(summary.kind), total: summary.total, paid: summary.paid, remaining: summary.remaining,
    installments: summary.installments, hasPixKey: Boolean(lodge?.pixKey?.trim()),
    charges: rows.map((r) => ({ target: r.target, number: r.number, amount: r.amount, dueDate: r.dueDate, late: r.late, noticeAt: r.noticeAt })),
  };
}

export type NoticeOutcome = { ok: true; notified: number; noticeAt: Date } | Fail;

/**
 * "Já paguei" de uma parcela do acordo: registra o aviso e manda UM e-mail à Tesouraria, ao Venerável e aos
 * Administradores. Não dá baixa em nada — a baixa é de quem confere o recebimento ("Registrar pagamento do acordo").
 */
export async function submitAgreementNotice(lodgeId: string, memberId: string, userId: string, target: ChargeTarget, note: string, now: Date = new Date()): Promise<NoticeOutcome> {
  const note300 = note.trim().slice(0, 300);
  const ctx = await withTenant(lodgeId, async (db) => {
    const block = await db.memberBlock.findFirst({ where: { lodgeId, memberId, status: 'open' }, include: { items: true } });
    if (!block) return null;
    const summary = await summarizeBlock(db, block, now);
    const notices = await latestNotices(db, lodgeId, block.id);
    const [member, lodge, staff] = await Promise.all([
      db.member.findFirst({ where: { id: memberId, lodgeId }, select: { name: true } }),
      db.lodge.findUnique({ where: { id: lodgeId }, select: LODGE_MESSAGING_SELECT }),
      db.user.findMany({ where: { lodgeId, role: { in: ['treasurer', 'admin', 'venerable'] }, status: 'active' }, select: { email: true } }),
    ]);
    return { summary, notices, member, lodge, staff };
  });
  if (!ctx || !ctx.member) return { ok: false, status: 404, error: 'Não há acordo em aberto para você.' };
  const charge = pickCharge(asBlock(ctx.summary), target, todayBR(now));
  if (!charge) return { ok: false, status: 409, error: 'Esta parcela já está coberta pelo que foi pago.' };
  const last = ctx.notices.get(String(charge.target));
  if (last && now.getTime() - last.getTime() < AGREEMENT_NOTICE_COOLDOWN_MS) {
    return { ok: false, status: 429, error: 'Você já avisou a Tesouraria sobre esta parcela nas últimas 24 horas.' };
  }

  await withTenant(lodgeId, (db) => logAudit(db, {
    lodgeId, userId, action: 'CREATE', entity: AGREEMENT_NOTICE_ENTITY, entityId: ctx.summary.id,
    metadata: { target: String(charge.target), amount: charge.amount, memberId, note: note300 || null },
  }));

  const what = charge.target === 'balance' ? 'a quitação do saldo do acordo' : `a parcela ${charge.number}/${ctx.summary.installments} do acordo`;
  const subject = `Aviso de pagamento do acordo — ${ctx.member.name}`;
  const body =
    `O irmão ${ctx.member.name} avisou que pagou ${what} (${brl(charge.amount)}, ${charge.target === 'balance' ? 'até' : 'vencimento'} ${formatDateOnly(charge.dueDate)}).\n` +
    (note300 ? `Observação do irmão: ${note300}\n` : '') +
    'Confira o recebimento na conta da loja e registre em Tesouraria → Acordos → Registrar pagamento do acordo.';
  const channels = buildLodgeChannels(ctx.lodge);
  let notified = 0;
  for (const to of new Set(ctx.staff.map((u) => u.email).filter(Boolean))) {
    const r = await dispatch('email', to, subject, body, channels).catch(() => null);
    if (r?.status === 'sent') notified++;
  }
  return { ok: true, notified, noticeAt: now };
}
