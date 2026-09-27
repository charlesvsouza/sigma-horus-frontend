import { todayBR } from '@/lib/date-only';
import { remainingAmount, sumMoney } from '@/lib/money';

// Regras puras da emissão automática no Asaas (ver lib/asaas-auto-emit.ts) — testáveis sem Prisma.

export const AUTO_EMIT_DAYS_AHEAD = 3; // mesmo horizonte do lembrete "a vencer"

const DAY_MS = 86_400_000;

/** Janela de vencimentos (data-só-dia, 00:00 UTC): de hoje (Brasília) até +N dias, inclusive. */
export function autoEmitWindow(now: Date = new Date(), days = AUTO_EMIT_DAYS_AHEAD): { from: Date; to: Date } {
  const from = todayBR(now);
  return { from, to: new Date(from.getTime() + days * DAY_MS) };
}

export interface AutoEmitCandidate {
  invoiceId: string;
  invoiceAmount: number;
  memberCpf: string | null;
  /** Conta de UM membro (1:1): o valor emitido é o saldo dela. Compartilhada: o valor da cobrança. */
  accountMemberId: string | null;
  accountAmount: number;
  accountStatus: string;
  accountPaid: number[];
}

export type AutoEmitDecision = { emit: true; value: number } | { emit: false; reason: 'paid' | 'no-cpf' };

/** O que fazer com uma cobrança da janela. Sem CPF o Asaas recusa — pula e conta para o relatório. */
export function decideAutoEmit(c: AutoEmitCandidate): AutoEmitDecision {
  if (c.accountStatus === 'paid') return { emit: false, reason: 'paid' };
  const value = c.accountMemberId ? remainingAmount(c.accountAmount, sumMoney(c.accountPaid)) : c.invoiceAmount;
  if (value <= 0) return { emit: false, reason: 'paid' };
  if (!c.memberCpf?.trim()) return { emit: false, reason: 'no-cpf' };
  return { emit: true, value: Math.min(value, c.invoiceAmount) };
}
