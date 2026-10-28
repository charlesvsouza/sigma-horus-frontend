import { round2, sumMoney } from '@/lib/money';

// Painel do Asaas: situação de cada cobrança emitida no Asaas e o resumo do período.
// Regras puras (sem Prisma) — a página só carrega os dados e chama estas funções.

export type AsaasSituation = 'waiting' | 'overdue' | 'settled' | 'cancelled';

export const ASAAS_SITUATION_LABEL: Record<AsaasSituation, string> = {
  waiting: 'Aguardando pagamento',
  overdue: 'Vencida',
  settled: 'Paga e baixada',
  cancelled: 'Cancelada',
};

/** Situação da cobrança no Asaas. `today` é a data-só-dia (00:00 UTC) de hoje em Brasília. */
export function asaasSituation(status: string, dueDate: Date, today: Date): AsaasSituation {
  if (status === 'paid') return 'settled';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  return dueDate.getTime() < today.getTime() ? 'overdue' : 'waiting';
}

export interface AsaasPanelRow {
  situation: AsaasSituation;
  amount: number;
  fee: number | null;
}

export interface AsaasPanelSummary {
  count: number;
  waiting: { count: number; total: number };
  overdue: { count: number; total: number };
  settled: { count: number; total: number; fees: number; net: number };
  cancelled: { count: number };
  /** Baixadas sem tarifa informada pelo Asaas — não entram no total de tarifas. */
  unknownFee: number;
}

export function summarizeAsaasRows(rows: AsaasPanelRow[]): AsaasPanelSummary {
  const by = (s: AsaasSituation) => rows.filter((r) => r.situation === s);
  const settled = by('settled');
  const fees = round2(sumMoney(settled.map((r) => r.fee ?? 0)));
  const total = round2(sumMoney(settled.map((r) => r.amount)));
  return {
    count: rows.length,
    waiting: { count: by('waiting').length, total: round2(sumMoney(by('waiting').map((r) => r.amount))) },
    overdue: { count: by('overdue').length, total: round2(sumMoney(by('overdue').map((r) => r.amount))) },
    settled: { count: settled.length, total, fees, net: round2(total - fees) },
    cancelled: { count: by('cancelled').length },
    unknownFee: settled.filter((r) => r.fee == null).length,
  };
}
