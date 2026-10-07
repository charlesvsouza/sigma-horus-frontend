// Rateio puro de um valor pelas cobranças em aberto de um irmão (usado por "Dividir pagamento").
import { round2 } from '@/lib/money';

/** Reparte `amount` pelas cobranças (já ordenadas da mais antiga para a mais nova), sem passar do saldo de cada uma. */
export function allocateOldestFirst(open: { accountId: string; title: string; dueDate: Date; remaining: number }[], amount: number): { allocations: { accountId: string; title: string; dueDate: Date; amount: number; remainingAfter: number }[]; unallocated: number } {
  let left = round2(amount);
  const allocations: { accountId: string; title: string; dueDate: Date; amount: number; remainingAfter: number }[] = [];
  for (const o of open) {
    if (left <= 0) break;
    const take = Math.min(left, o.remaining);
    if (take <= 0) continue;
    allocations.push({ accountId: o.accountId, title: o.title, dueDate: o.dueDate, amount: round2(take), remainingAfter: round2(o.remaining - take) });
    left = round2(left - take);
  }
  return { allocations, unallocated: left };
}

