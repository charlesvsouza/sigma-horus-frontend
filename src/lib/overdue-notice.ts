import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { ART_002_THRESHOLD_DAYS } from '@/lib/overdue-rules';

// Aviso de inadimplência (relatório Inadimplência — Art. 002): um e-mail ou WhatsApp por irmão que diz que há
// mensalidades vencidas em aberto, que é preciso regularizar para não aumentar o custo do atraso e evitar o
// enquadramento no Art. 002 (mais de 60 dias). Texto aprovado pelo dono em 2026-10-05; WhatsApp substituído pelo texto do Venerável Mestre (mesmo dia). Tom fraterno, sem ameaça:
// o Art. 002 hoje só informa e o bloqueio é ato manual do Venerável.

export const OVERDUE_NOTICE_LOG_TITLE = 'Aviso de inadimplência (Art. 002)';
export const OVERDUE_NOTICE_WHATSAPP_LOG_TITLE = 'WhatsApp: aviso de inadimplência (Art. 002)';
/** Intervalo mínimo entre dois avisos ao mesmo irmão (qualquer canal) — o mesmo do aviso automático. */
export const OVERDUE_NOTICE_INTERVAL_DAYS = 7;
export const OVERDUE_NOTICE_SIGNOFF = 'Fraternalmente, Tesouraria.';

export const overdueNoticeRef = (memberId: string) => `overdue-notice:${memberId}`;

/** Só irmão ATIVO recebe: bloqueado já tem acordo; afastado/suspenso/inativo tem outro tratamento. */
export const canReceiveOverdueNotice = (member: { status: string; deceased?: boolean | null }) => member.status === 'active' && !member.deceased;

export function overdueNoticeWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - OVERDUE_NOTICE_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
}

export interface OverdueNoticeInput {
  memberName: string;
  lodgeName: string;
  /** Quantidade de cobranças vencidas e o total em aberto. */
  count: number;
  total: number;
  oldestDueDate: Date | string;
  daysOverdue: number;
  /** Loja com o Art. 002 ligado: o aviso cita o enquadramento. */
  art002Enabled: boolean;
  /** A loja tem multa/juros configurados: o aviso diz que o custo aumenta com eles. */
  hasLateFees: boolean;
  /** Portal do irmão (null no Modo Loja sem chave Pix: o portal não serve para pagar). */
  portalUrl: string | null;
  /** Modo Loja sem portal: dados bancários/Pix da loja. */
  instructions: string | null;
}

const countLabel = (n: number) => (n === 1 ? '1 cobrança vencida' : `${n} cobranças vencidas`);
/** Como a lei é citada ao irmão (redação do Venerável Mestre). */
const LAW_002 = 'Lei nº 002, que dispõe sobre a inadimplência dos Obreiros e dá outras providências';
const alreadyIn = (i: OverdueNoticeInput) => i.art002Enabled && i.daysOverdue > ART_002_THRESHOLD_DAYS;

export function overdueNoticeSubject(lodgeName: string): string {
  return `Pendências vencidas na Tesouraria da ${lodgeName}`;
}

function summaryLine(i: OverdueNoticeInput): string {
  return `Constam em aberto, na Tesouraria da ${i.lodgeName}, ${countLabel(i.count)}, no total de ${brl(i.total)}, a mais antiga vencida em ${formatDateOnly(i.oldestDueDate)} (há ${i.daysOverdue} ${i.daysOverdue === 1 ? 'dia' : 'dias'}).`;
}

function attentionLine(i: OverdueNoticeInput): string {
  const cost = `O acúmulo de mensalidades em aberto aumenta o custo para o irmão${i.hasLateFees ? ', com multa e juros conforme as regras da Loja' : ''}`;
  return i.art002Enabled
    ? `Pedimos a sua atenção para regularizar esses valores o quanto antes. ${cost} e, passados ${ART_002_THRESHOLD_DAYS} dias de atraso, leva ao enquadramento na ${LAW_002}.`
    : `Pedimos a sua atenção para regularizar esses valores o quanto antes. ${cost}.`;
}

const ALREADY_LINE = 'Seu cadastro já se enquadra nesse prazo, e por isso é importante falar com a Tesouraria agora.';
const NEGOTIATE_LINE = 'Se houver dificuldade, procure o Tesoureiro: é possível conversar sobre o parcelamento.';
const PAID_LINE = 'Se já pagou, desconsidere este aviso e, por favor, nos envie o comprovante.';

function payLine(i: OverdueNoticeInput): string {
  if (i.portalUrl) return `Você pode pagar pelo portal: ${i.portalUrl}`;
  if (i.instructions) return `Como pagar:\n${i.instructions}`;
  return 'Para pagar, procure a Tesouraria.';
}

/** Corpo em texto puro (também o conteúdo do MessageLog e o fallback de clientes sem HTML). */
export function overdueNoticeText(i: OverdueNoticeInput): string {
  return [
    `Caro irmão ${i.memberName},`,
    summaryLine(i),
    attentionLine(i),
    ...(alreadyIn(i) ? [ALREADY_LINE] : []),
    `${payLine(i)}\n${NEGOTIATE_LINE}`,
    PAID_LINE,
    OVERDUE_NOTICE_SIGNOFF,
  ].join('\n\n');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const BUTTON = 'display:inline-block;background:#8B6914;color:#ffffff;text-decoration:none;font-weight:bold;padding:9px 18px;border-radius:6px;font-size:14px';

/** Corpo em HTML (vai dentro da moldura com o brasão da loja — lib/messaging). */
export function overdueNoticeHtml(i: OverdueNoticeInput): string {
  const p = (html: string, style = '') => `<p style="margin:0 0 14px${style ? `;${style}` : ''}">${html}</p>`;
  const pay = i.portalUrl
    ? `<div style="margin:0 0 14px"><a href="${esc(i.portalUrl)}" style="${BUTTON}">Pagar pelo portal</a></div>`
    : p(esc(payLine(i)).replace(/\n/g, '<br>'));
  return [
    p(`Caro irmão ${esc(i.memberName)},`),
    `<div style="border:1px solid #e2ddc8;border-left:4px solid #9b1c1c;border-radius:6px;padding:14px 16px;margin:0 0 14px">${esc(summaryLine(i))}</div>`,
    p(esc(attentionLine(i))),
    ...(alreadyIn(i) ? [p(`<strong>${esc(ALREADY_LINE)}</strong>`)] : []),
    pay,
    p(esc(NEGOTIATE_LINE)),
    p(esc(PAID_LINE), 'font-size:13px;color:#4A4035'),
    p(esc(OVERDUE_NOTICE_SIGNOFF)),
  ].join('\n');
}

/**
 * Versão para WhatsApp (o Tesoureiro envia pelo wa.me). Redação do Venerável Mestre, em três parágrafos:
 * situação e pedido de regularização, como pagar, e o comprovante. Mesma para quem já passou de 60 dias.
 */
export function overdueNoticeWhatsApp(i: OverdueNoticeInput): string {
  const days = `${i.daysOverdue} ${i.daysOverdue === 1 ? 'dia' : 'dias'}`;
  const verb = i.count === 1 ? 'consta' : 'constam';
  const head = `Caro irmão ${i.memberName}, ${verb} ${countLabel(i.count)} na Tesouraria da ${i.lodgeName}, somando ${brl(i.total)} (a mais antiga vencida há ${days}).`;
  const ask = i.art002Enabled
    ? `Para não aumentar os custos do atraso e evitar o enquadramento na ${LAW_002}, pedimos que regularize essa situação o quanto antes.`
    : 'Para não aumentar os custos do atraso, pedimos que regularize essa situação o quanto antes.';
  const pay = i.portalUrl
    ? `Pague pelo portal: ${i.portalUrl} ou fale comigo para parcelar.`
    : i.instructions
      ? `Como pagar — ${i.instructions.replace(/\n/g, ' | ')}. Se preferir, fale comigo para parcelar.`
      : 'Fale comigo para pagar ou parcelar.';
  return [`${head} ${ask}`, pay, 'Se já pagou, responda enviando o comprovante. Fraternalmente, Tesouraria'].join('\n');
}
