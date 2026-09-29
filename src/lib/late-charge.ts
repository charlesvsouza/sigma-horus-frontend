import { daysOverdueBR, todayBR } from '@/lib/date-only';
import { round2 } from '@/lib/money';

// Multa (única) + juros de mora (ao mês, pro-rata por dia) sobre um valor em atraso.
// Por padrão é INFORMATIVO (relatório de inadimplência e renegociação). Com a opção da loja
// "Cobrar multa e juros no Pix" (Lodge.chargeLateFeesOnPix, só Modo Loja), o Pix de cobrança
// vencida sai com o acréscimo, a conferência do comprovante aceita o valor atualizado e a baixa
// lança o acréscimo à parte, em "Multas e Juros por Atraso" — a mensalidade fica pelo valor original.

export interface LateCharge {
  fee: number;
  interest: number;
  total: number; // amount + fee + interest
}

export function calculateLateCharge(
  amount: number,
  daysOverdue: number,
  feePercent?: number | null,
  interestPercentMonth?: number | null,
): LateCharge {
  if (daysOverdue <= 0) return { fee: 0, interest: 0, total: amount };
  const fee = feePercent ? amount * (feePercent / 100) : 0;
  const interest = interestPercentMonth ? amount * (interestPercentMonth / 100) * (daysOverdue / 30) : 0;
  return { fee, interest, total: amount + fee + interest };
}

/** Categoria de receita do acréscimo recebido (criada na primeira baixa, como a tarifa do Asaas). */
export const LATE_CHARGE_CHART = {
  code: '1.2.06',
  name: 'Multas e Juros por Atraso',
  type: 'REVENUE' as const,
  category: 'Outras Receitas',
};

export interface LateChargeConfig {
  enabled: boolean;
  feePercent: number | null;
  interestPercentMonth: number | null;
}

export function lateChargeConfig(lodge: {
  chargeLateFeesOnPix?: boolean | null;
  lateFeePercent?: number | null;
  lateInterestPercentMonth?: number | null;
} | null | undefined): LateChargeConfig {
  const feePercent = lodge?.lateFeePercent && lodge.lateFeePercent > 0 ? lodge.lateFeePercent : null;
  const interestPercentMonth = lodge?.lateInterestPercentMonth && lodge.lateInterestPercentMonth > 0 ? lodge.lateInterestPercentMonth : null;
  return { enabled: Boolean(lodge?.chargeLateFeesOnPix) && (feePercent !== null || interestPercentMonth !== null), feePercent, interestPercentMonth };
}

export interface PixAmount {
  principal: number;
  fee: number;
  interest: number;
  /** Multa + juros, em centavos exatos. 0 quando a opção está desligada ou não venceu. */
  extra: number;
  total: number;
}

/** Valor do Pix de uma cobrança num dia: o saldo e, se a loja cobra, multa e juros até aquele dia. */
export function pixAmount(balance: number, dueDate: Date | string, cfg: LateChargeConfig, now: Date = new Date()): PixAmount {
  const principal = round2(balance);
  const days = daysOverdueBR(dueDate, now);
  if (!cfg.enabled || days <= 0) return { principal, fee: 0, interest: 0, extra: 0, total: principal };
  const c = calculateLateCharge(principal, days, cfg.feePercent, cfg.interestPercentMonth);
  const fee = round2(c.fee);
  const interest = round2(c.interest);
  const extra = round2(fee + interest);
  return { principal, fee, interest, extra, total: round2(principal + extra) };
}

const DAY_MS = 86_400_000;
/** Até quantos dias para trás procurar o valor com juros (o Pix pode ter sido gerado dias antes do pagamento). */
const MAX_LOOKBACK_DAYS = 400;

/**
 * Valores aceitáveis no comprovante: o saldo sem acréscimo e, com a opção ligada, o total com
 * multa e juros calculado para CADA dia entre o vencimento e hoje — o irmão pode ter pago com o
 * Pix de dias atrás. Para várias contas (Pix agrupado), a soma no mesmo dia.
 */
export function acceptableAmounts(items: { balance: number; dueDate: Date | string }[], cfg: LateChargeConfig, now: Date = new Date()): number[] {
  const plain = round2(items.reduce((s, i) => s + i.balance, 0));
  const out = new Set<number>([plain]);
  if (!cfg.enabled || items.length === 0) return [...out];
  const today = todayBR(now).getTime();
  for (let k = 0; k <= MAX_LOOKBACK_DAYS; k++) {
    // Meio-dia de Brasília do dia k para trás (evita a virada do dia no cálculo).
    const day = new Date(today - k * DAY_MS + 15 * 3_600_000);
    const parts = items.map((i) => pixAmount(i.balance, i.dueDate, cfg, day));
    if (parts.every((p) => p.extra === 0)) break;
    out.add(round2(parts.reduce((s, p) => s + p.total, 0)));
  }
  return [...out];
}

/**
 * Marca do lançamento de multa/juros criado na baixa: liga o acréscimo à baixa principal para o
 * estorno desfazer os dois juntos (estornar só um deixaria a loja com receita sem a mensalidade,
 * ou o irmão "devendo" a multa de uma baixa desfeita).
 */
export const LATE_CHARGE_MARK = 'Acréscimo por atraso recebido na baixa ';
export function lateChargeMarker(paymentId: string): string {
  return `${LATE_CHARGE_MARK}${paymentId}.`;
}
export function mainPaymentIdFromMarker(description: string | null | undefined): string | null {
  return description?.startsWith(LATE_CHARGE_MARK) ? description.slice(LATE_CHARGE_MARK.length).replace(/\.$/, '') : null;
}

/** Frase do acréscimo para mensagens: "Com multa (R$ 2,40) e juros (R$ 1,20) por atraso até hoje, o valor atualizado é R$ 123,60." */
export function lateChargeSentence(p: PixAmount, fmt: (n: number) => string): string | null {
  if (p.extra <= 0) return null;
  const parts = [p.fee > 0 ? `multa (${fmt(p.fee)})` : null, p.interest > 0 ? `juros (${fmt(p.interest)})` : null].filter(Boolean).join(' e ');
  return `Com ${parts} por atraso até hoje, o valor atualizado é ${fmt(p.total)}.`;
}
