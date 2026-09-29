import { brl } from '@/lib/currency';
import { daysOverdueBR, formatDateOnly } from '@/lib/date-only';
import { remainingAmount, round2, sumMoney } from '@/lib/money';

// Texto dos avisos de cobrança ao irmão — fonte única para o e-mail automático (cron diário)
// e para o envio manual pelo WhatsApp, pra os dois não se afastarem com o tempo.

export interface ChargeNoticeInput {
  memberName: string;
  number: string;
  /** Valor cobrado no aviso (no WhatsApp, o saldo em aberto). */
  amount: number;
  /** Vencimento (data-só-dia, formatada em UTC — ver lib/date-only). */
  dueDate: Date | string;
  overdue: boolean;
}

export const CHARGE_NOTICE_SIGNOFF = 'Fraternalmente, Tesouraria.';

/** Janela do lembrete "a vencer" — a mesma do e-mail automático. */
export const DUE_SOON_DAYS = 3;

export type ChargeUrgency = 'overdue' | 'dueSoon' | 'later';

/** Vencida (calendário de Brasília; vence hoje ainda está em dia), a vencer em até 3 dias, ou depois. */
export function chargeUrgency(dueDate: Date | string, status: string, now: Date = new Date()): ChargeUrgency {
  const days = daysOverdueBR(dueDate, now);
  if (status === 'overdue' || days > 0) return 'overdue';
  return days >= -DUE_SOON_DAYS ? 'dueSoon' : 'later';
}

export function chargeNoticeTitle(overdue: boolean): string {
  return overdue ? 'Aviso de cobrança vencida' : 'Lembrete de cobrança a vencer';
}

/**
 * Saldo em aberto da cobrança: o valor dela, limitado ao que falta pagar na conta a receber
 * ligada (pagamentos parciais já descontados). Paga → 0.
 */
export function invoiceOpenBalance(invoiceAmount: number, account: { amount: number; status: string; payments: { amount: number }[] } | null): number {
  if (!account) return round2(invoiceAmount);
  if (account.status === 'paid') return 0;
  const accountBalance = remainingAmount(Number(account.amount), sumMoney(account.payments.map((p) => Number(p.amount))));
  return round2(Math.max(0, Math.min(Number(invoiceAmount), accountBalance)));
}

/** Abertura do aviso: "Caro irmão…, lembramos a cobrança…" ou "…consta a cobrança…, vencida…". */
export function chargeNoticeLead(input: ChargeNoticeInput): string {
  const valor = brl(input.amount);
  const data = formatDateOnly(input.dueDate);
  return input.overdue
    ? `Caro irmão ${input.memberName}, consta a cobrança ${input.number} no valor de ${valor}, vencida em ${data}. Por gentileza, regularize.`
    : `Caro irmão ${input.memberName}, lembramos a cobrança ${input.number} no valor de ${valor}, com vencimento em ${data}.`;
}

/**
 * Mensagem de WhatsApp (Modo Loja). O Pix copia e cola vai numa linha só, sem formatação
 * em volta (um *negrito* iria junto na cópia) — no celular o irmão não consegue escanear o
 * QR que está na própria tela, então o código é o meio principal. Sem chave Pix, vão os
 * dados bancários da loja.
 */
export function whatsAppChargeMessage(input: ChargeNoticeInput & { pixCopyPaste?: string | null; instructions?: string | null }): string {
  const parts = [chargeNoticeLead(input)];
  if (input.pixCopyPaste) {
    parts.push('Para pagar, copie o código abaixo e cole no app do seu banco em "Pix copia e cola":', input.pixCopyPaste);
  } else if (input.instructions) {
    parts.push(`Como pagar:\n${input.instructions}`);
  }
  parts.push('Depois de pagar, responda esta mensagem com o comprovante.', CHARGE_NOTICE_SIGNOFF);
  return parts.join('\n\n');
}
