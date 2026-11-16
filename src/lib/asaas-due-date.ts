import { todayBR } from '@/lib/date-only';

/** Vencimento enviado ao Asaas: ele recusa data no passado, então conta vencida vai com "hoje" (Brasília). */
export function asaasDueDate(dueDate: Date, now: Date = new Date()): string {
  const today = todayBR(now);
  return (dueDate.getTime() < today.getTime() ? today : dueDate).toISOString().slice(0, 10);
}
