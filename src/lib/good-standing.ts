import { daysOverdueBR } from '@/lib/date-only';
import { remainingAmount, sumMoney } from '@/lib/money';

// Declaração de regularidade financeira ("nada consta"): documento que a loja emite em
// transferência, elevação, filiação, candidatura a cargo. Regular = nenhuma conta que o
// irmão deve à loja VENCIDA e em aberto (a vencer não impede). Lógica pura, testável.

export interface OpenDebt {
  title: string;
  dueDate: Date;
  /** Saldo em aberto (já descontados parciais). */
  balance: number;
}

export interface GoodStanding {
  regular: boolean;
  overdue: { title: string; dueDate: string; balance: number; days: number }[];
  overdueTotal: number;
  /** Em aberto mas ainda no prazo — não impede a declaração, só é informado à Tesouraria. */
  upcomingTotal: number;
}

export function evaluateGoodStanding(debts: OpenDebt[], now: Date = new Date()): GoodStanding {
  const open = debts.filter((d) => d.balance > 0);
  const overdue = open
    .map((d) => ({ ...d, days: daysOverdueBR(d.dueDate, now) }))
    .filter((d) => d.days > 0)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const upcoming = open.filter((d) => daysOverdueBR(d.dueDate, now) <= 0);
  return {
    regular: overdue.length === 0,
    overdue: overdue.map((d) => ({ title: d.title, dueDate: d.dueDate.toISOString(), balance: d.balance, days: d.days })),
    overdueTotal: sumMoney(overdue.map((d) => d.balance)),
    upcomingTotal: sumMoney(upcoming.map((d) => d.balance)),
  };
}

/** Saldo de uma conta a partir do valor e dos pagamentos. */
export function debtBalance(amount: number, payments: number[]): number {
  return remainingAmount(amount, sumMoney(payments));
}

/**
 * Número da declaração: dia + trecho do cadastro, para citar e conferir com a Tesouraria
 * (ex.: "20260927-3F9A1C"). Não é segredo nem assinatura digital.
 */
export function declarationNumber(memberId: string, now: Date = new Date()): string {
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
  return `${br}-${memberId.slice(-6).toUpperCase()}`;
}
