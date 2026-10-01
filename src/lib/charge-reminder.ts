import { CHARGE_NOTICE_SIGNOFF, chargeUrgency } from '@/lib/charge-notice';
import { brl } from '@/lib/currency';
import { daysOverdueBR, formatDateOnly, todayBR } from '@/lib/date-only';
import { round2, sumMoney } from '@/lib/money';

// Lembrete de cobranças em aberto por e-mail: UM e-mail por irmão, com todas as cobranças
// dele em blocos separados — cada bloco com o próprio meio de pagamento (Pix copia e cola da
// cobrança no Modo Loja; link do Asaas, ou o portal se ainda não emitida, no Modo Asaas), para
// o irmão poder pagar uma sem a outra. Lógica pura: o servidor (charge-reminder-server) monta
// os itens com os dados da loja e envia.

export type ReminderScope = 'all' | 'due' | 'overdue';

export const REMINDER_SCOPES: { value: ReminderScope; label: string }[] = [
  { value: 'all', label: 'Todas em aberto' },
  { value: 'due', label: 'Vencidas e a vencer em até 3 dias' },
  { value: 'overdue', label: 'Só vencidas' },
];

export function normalizeReminderScope(value: unknown): ReminderScope {
  return value === 'due' || value === 'overdue' ? value : 'all';
}

/** Título do envio em lote no MessageLog — também a trava de "um por irmão por dia". */
export const BULK_REMINDER_LOG_TITLE = 'Lembrete de cobranças em aberto';

/** Título do lembrete de uma cobrança só (botão "Lembrar por e-mail" da linha). */
export function singleReminderLogTitle(number: string): string {
  return `Lembrete de cobrança ${number}`;
}

/**
 * Lembrete automático diário (cron): SÓ cobranças vencidas há MAIS de 30 dias, num e-mail por
 * irmão (decisão do dono, 2026-10-01). Antes: um e-mail por cobrança, a vencer em 3 dias e vencidas.
 */
export const AUTO_REMINDER_MIN_DAYS_OVERDUE = 30;
export const AUTO_REMINDER_LOG_TITLE = 'Aviso de cobranças vencidas há mais de 30 dias';

/** Vencida há mais de `days` dias (calendário de Brasília). */
export function overdueMoreThan(dueDate: Date | string, days: number, now: Date = new Date()): boolean {
  return daysOverdueBR(dueDate, now) > days;
}

/** Meia-noite de hoje em Brasília, como instante — início da janela de "já recebeu hoje". */
export function startOfTodayBR(now: Date = new Date()): Date {
  return new Date(todayBR(now).getTime() + 3 * 60 * 60_000);
}

export interface ReminderItem {
  invoiceId: string;
  number: string;
  /** Título da conta a receber (ex.: "Mensalidade setembro/2026"); vazio se não houver. */
  title: string;
  dueDate: Date | string;
  status: string;
  /** Saldo em aberto (pagamentos parciais já descontados). */
  balance: number;
  /** Valor a pagar hoje: o saldo e, se a loja cobra no Pix, multa e juros. */
  payAmount: number;
  /** "Com multa (…) e juros (…), o valor atualizado é …" — null sem acréscimo. */
  lateSentence: string | null;
  /** Modo Loja com chave Pix: código copia e cola desta cobrança. */
  pixCopyPaste: string | null;
  /** Modo Asaas com a cobrança emitida: link público dela. */
  payUrl: string | null;
}

export interface ReminderMember { id: string; name: string; email: string | null }

export interface ReminderGroup {
  member: ReminderMember;
  items: ReminderItem[];
  /** Soma do que pagar hoje. */
  total: number;
}

/** Cobranças com saldo dentro do escopo escolhido (vencida = calendário de Brasília). */
export function inReminderScope(item: { dueDate: Date | string; status: string; balance: number }, scope: ReminderScope, now: Date = new Date()): boolean {
  if (item.balance <= 0) return false;
  if (scope === 'all') return true;
  const urgency = chargeUrgency(item.dueDate, item.status, now);
  return scope === 'overdue' ? urgency === 'overdue' : urgency !== 'later';
}

/** Agrupa por irmão (ordem alfabética), cobranças da mais antiga para a mais nova. */
export function groupReminders(rows: { member: ReminderMember; item: ReminderItem }[]): ReminderGroup[] {
  const byMember = new Map<string, ReminderGroup>();
  for (const { member, item } of rows) {
    const group = byMember.get(member.id) ?? { member, items: [], total: 0 };
    group.items.push(item);
    byMember.set(member.id, group);
  }
  const time = (d: Date | string) => new Date(d).getTime();
  return [...byMember.values()]
    .map((g) => {
      const items = [...g.items].sort((a, b) => time(a.dueDate) - time(b.dueDate) || a.number.localeCompare(b.number));
      return { ...g, items, total: round2(sumMoney(items.map((i) => i.payAmount))) };
    })
    .sort((a, b) => a.member.name.localeCompare(b.member.name, 'pt-BR'));
}

export interface ReminderEmailOptions {
  lodgeName: string;
  /** Portal do irmão — null quando não serve para pagar (Modo Loja sem chave Pix). */
  portalUrl: string | null;
  /** Modo Loja: chave Pix/dados bancários (vão uma vez, no fim, quando falta o Pix por cobrança). */
  instructions: string | null;
  now?: Date;
}

const countLabel = (n: number) => (n === 1 ? '1 cobrança' : `${n} cobranças`);

export function reminderSubject(group: ReminderGroup, lodgeName: string): string {
  const n = group.items.length;
  return `${n === 1 ? 'Cobrança em aberto' : `${n} cobranças em aberto`} — ${lodgeName}`;
}

function itemStatusLine(item: ReminderItem, now: Date): string {
  const overdue = chargeUrgency(item.dueDate, item.status, now) === 'overdue';
  return `${overdue ? 'Vencida em' : 'Vence em'} ${formatDateOnly(item.dueDate)} · ${brl(item.balance)}`;
}

function intro(group: ReminderGroup): string {
  const n = group.items.length;
  return n === 1
    ? `Consta 1 cobrança em aberto em seu nome, no valor de ${brl(group.total)}:`
    : `Constam ${countLabel(n)} em aberto em seu nome, no total de ${brl(group.total)}. Cada uma pode ser paga separadamente:`;
}

function closingLines(group: ReminderGroup, opts: ReminderEmailOptions): string[] {
  const lines: string[] = [];
  const needsInstructions = group.items.some((i) => !i.pixCopyPaste && !i.payUrl) && !opts.portalUrl;
  if (needsInstructions && opts.instructions) lines.push(`Como pagar:\n${opts.instructions}`);
  if (opts.portalUrl && group.items.length > 1) lines.push(`Prefere pagar várias de uma vez? No seu portal (Minhas pendências) dá para juntar as cobranças num Pix só: ${opts.portalUrl}`);
  lines.push('Se você já pagou, desconsidere este aviso.');
  return lines;
}

/** Corpo em texto puro (também o fallback de clientes sem HTML e o conteúdo do MessageLog). */
export function reminderText(group: ReminderGroup, opts: ReminderEmailOptions): string {
  const now = opts.now ?? new Date();
  const blocks = group.items.map((item, idx) => {
    const lines = [`${idx + 1}) ${item.number}${item.title ? ` — ${item.title}` : ''}`, `   ${itemStatusLine(item, now)}`];
    if (item.lateSentence) lines.push(`   ${item.lateSentence}`);
    if (item.payUrl) lines.push(`   Pagar esta cobrança: ${item.payUrl}`);
    // Código sem recuo, numa linha só: copiar a linha não leva espaços junto.
    else if (item.pixCopyPaste) lines.push('   Pix copia e cola desta cobrança:', item.pixCopyPaste);
    else if (opts.portalUrl) lines.push(`   Pague pelo seu portal: ${opts.portalUrl}`);
    return lines.join('\n');
  });
  return [`Caro irmão ${group.member.name},`, intro(group), ...blocks, ...closingLines(group, opts), CHARGE_NOTICE_SIGNOFF].join('\n\n');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const BUTTON = 'display:inline-block;background:#8B6914;color:#ffffff;text-decoration:none;font-weight:bold;padding:9px 18px;border-radius:6px;font-size:14px';

/** Corpo em HTML (vai dentro da moldura com o brasão da loja — lib/messaging). */
export function reminderHtml(group: ReminderGroup, opts: ReminderEmailOptions): string {
  const now = opts.now ?? new Date();
  const p = (html: string, style = '') => `<p style="margin:0 0 14px${style ? `;${style}` : ''}">${html}</p>`;
  const blocks = group.items.map((item) => {
    const overdue = chargeUrgency(item.dueDate, item.status, now) === 'overdue';
    const parts = [
      `<div style="font-weight:bold;font-size:15px">${esc(item.number)}${item.title ? ` <span style="font-weight:normal;color:#4A4035">— ${esc(item.title)}</span>` : ''}</div>`,
      `<div style="margin-top:4px;color:${overdue ? '#9b1c1c' : '#4A4035'}">${esc(itemStatusLine(item, now))}</div>`,
    ];
    if (item.lateSentence) parts.push(`<div style="margin-top:4px;color:#4A4035">${esc(item.lateSentence)}</div>`);
    if (item.payUrl) {
      parts.push(`<div style="margin-top:12px"><a href="${esc(item.payUrl)}" style="${BUTTON}">Pagar esta cobrança</a></div>`);
    } else if (item.pixCopyPaste) {
      parts.push(
        `<div style="margin-top:12px;font-size:13px;color:#4A4035">Pix copia e cola desta cobrança — copie o código e cole no app do seu banco:</div>`,
        `<div style="margin-top:6px;font-family:Consolas,Menlo,monospace;font-size:12px;line-height:1.5;word-break:break-all;background:#f4f1e8;border:1px dashed #c9b98a;border-radius:6px;padding:10px">${esc(item.pixCopyPaste)}</div>`,
      );
    } else if (opts.portalUrl) {
      parts.push(`<div style="margin-top:12px"><a href="${esc(opts.portalUrl)}" style="${BUTTON}">Pagar pelo portal</a></div>`);
    }
    return `<div style="border:1px solid #e2ddc8;border-left:4px solid ${overdue ? '#9b1c1c' : '#8B6914'};border-radius:6px;padding:14px 16px;margin:0 0 14px">${parts.join('')}</div>`;
  });
  const closing = closingLines(group, opts).map((line) => {
    const html = esc(line).replace(/\n/g, '<br>');
    return p(opts.portalUrl ? html.replace(esc(opts.portalUrl), `<a href="${esc(opts.portalUrl)}" style="color:#8B6914">${esc(opts.portalUrl)}</a>`) : html, 'font-size:13px;color:#4A4035');
  });
  return [p(`Caro irmão ${esc(group.member.name)},`), p(esc(intro(group))), ...blocks, ...closing, p(esc(CHARGE_NOTICE_SIGNOFF))].join('\n');
}

/** Versão curta para WhatsApp/SMS (sem os códigos Pix): resumo + onde pagar. */
export function reminderShortText(group: ReminderGroup, opts: ReminderEmailOptions): string {
  const n = group.items.length;
  const what = n === 1
    ? `consta em aberto a cobrança ${group.items[0].number}, no valor de ${brl(group.total)}`
    : `constam em aberto ${countLabel(n)} (${group.items.map((i) => i.number).join(', ')}), no total de ${brl(group.total)}`;
  const where = opts.portalUrl ? ` Pague pelo seu portal: ${opts.portalUrl}.` : opts.instructions ? ` Como pagar — ${opts.instructions.replace(/\n/g, ' | ')}.` : '';
  return `Caro irmão ${group.member.name}, ${what}. Por gentileza, regularize.${where} ${CHARGE_NOTICE_SIGNOFF}`;
}
