import { isOutOfPolicyMethod } from '@/lib/collection';
import { round2, sumMoney } from '@/lib/money';

// Relatório de tarifas de cobrança: o que o Asaas realmente cobrou (valor − líquido, informado por
// ele em cada recebimento) e o que a loja absorveu. Política atual: a loja ABSORVE a tarifa; a
// coluna "repassada" existe para o dia em que houver repasse ao membro.

export interface FeeRow {
  id: string;
  date: Date;
  invoiceNumber: string | null;
  memberName: string | null;
  method: string | null; // PIX | BOLETO | CREDIT_CARD... (do Asaas)
  gross: number; // valor recebido
  fee: number | null; // tarifa real; null = o Asaas não informou o líquido
  passedOn: number; // parte repassada ao membro (hoje sempre 0)
}

export interface FeeBucket { key: string; count: number; gross: number; fee: number }

export interface FeeReport {
  count: number;
  gross: number;
  fee: number; // tarifa paga ao Asaas
  net: number; // o que efetivamente chegou (bruto − tarifa)
  passedOn: number;
  absorbed: number; // fee − passedOn
  averageFee: number;
  feePercent: number; // tarifa / bruto
  unknownFeeCount: number; // recebimentos sem tarifa informada
  outOfPolicy: FeeRow[]; // método fora da política (ex.: cartão)
  byMethod: FeeBucket[];
  byMonth: FeeBucket[];
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

function bucketize(rows: FeeRow[], keyOf: (r: FeeRow) => string): FeeBucket[] {
  const map = new Map<string, FeeRow[]>();
  for (const r of rows) {
    const k = keyOf(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      count: list.length,
      gross: sumMoney(list.map((r) => r.gross)),
      fee: sumMoney(list.map((r) => r.fee ?? 0)),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function buildFeeReport(rows: FeeRow[]): FeeReport {
  const gross = sumMoney(rows.map((r) => r.gross));
  const fee = sumMoney(rows.map((r) => r.fee ?? 0));
  const passedOn = sumMoney(rows.map((r) => r.passedOn));
  const withFee = rows.filter((r) => r.fee != null);
  return {
    count: rows.length,
    gross,
    fee,
    net: round2(gross - fee),
    passedOn,
    absorbed: round2(fee - passedOn),
    averageFee: withFee.length ? round2(fee / withFee.length) : 0,
    feePercent: gross > 0 ? Math.round((fee / gross) * 10000) / 100 : 0,
    unknownFeeCount: rows.length - withFee.length,
    outOfPolicy: rows.filter((r) => isOutOfPolicyMethod(r.method)),
    byMethod: bucketize(rows, (r) => r.method ?? 'Não informado'),
    byMonth: bucketize(rows, (r) => monthKey(r.date)),
  };
}

/** Extrai o id da cobrança no Asaas da nota gravada pela baixa: "Baixa automática Asaas (pay_xxx)". */
export function asaasIdFromNote(note: string | null | undefined): string | null {
  const m = /\(([^()]+)\)\s*$/.exec(note ?? '');
  return m ? m[1] : null;
}
