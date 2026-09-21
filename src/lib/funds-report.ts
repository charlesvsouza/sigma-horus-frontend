import { computeAccountStatement, type AccountStatement, type StatementMovementInput } from '@/lib/financial-accounts';
import { sumMoney } from '@/lib/money';

// Relatório de gestão de um fundo (Tronco de Beneficência / Doações e Contribuições):
// tudo calculado a partir dos pagamentos lançados nas CATEGORIAS do fundo, em qualquer
// banco/caixa da loja (o fundo não tem caixa próprio). Funções puras — o carregamento
// do banco fica na página.

export type FundOrigin = 'campaign' | 'session' | 'other';

/** Um pagamento lançado em categoria do fundo. */
export interface FundMovementRow {
  id: string;
  date: Date;
  direction: 'in' | 'out';
  amount: number;
  title: string;
  category: string;
  method: string;
  origin: FundOrigin;
  /** Rótulo da origem: título da campanha ou data da sessão. */
  originLabel: string | null;
  /** Nome do doador já mascarado conforme o papel de quem vê; null = não identificado. */
  donor: string | null;
}

export interface FundReportInput {
  movements: FundMovementRow[];
  from: Date;
  to: Date;
  now?: Date;
}

export interface Bucket { label: string; total: number; count: number }

export interface FundReport {
  statement: AccountStatement;
  /** Saldo do fundo hoje (todo o histórico), independente do período escolhido. */
  balanceNow: number;
  entriesByOrigin: { campaign: number; session: number; other: number };
  /** Detalhe das entradas por campanha / sessão, maior primeiro. */
  entryDetail: (Bucket & { origin: FundOrigin })[];
  exitsByTitle: Bucket[];
  donors: Bucket[];
  monthly: { month: string; in: number; out: number; net: number }[];
}

function inRange(d: Date, from: Date, to: Date) {
  return d >= from && d <= to;
}

function bucketize(items: { label: string; amount: number }[]): Bucket[] {
  const map = new Map<string, { amounts: number[] }>();
  for (const it of items) {
    const cur = map.get(it.label) ?? { amounts: [] };
    cur.amounts.push(it.amount);
    map.set(it.label, cur);
  }
  return [...map.entries()]
    .map(([label, v]) => ({ label, total: sumMoney(v.amounts), count: v.amounts.length }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

/** Últimos `n` meses terminando no mês de `end` (UTC), do mais antigo ao mais recente. */
export function lastMonths(end: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(monthKey(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1))));
  }
  return out;
}

export function buildFundReport(input: FundReportInput): FundReport {
  const { movements, from, to } = input;
  const now = input.now ?? new Date();

  const stmtInputs: StatementMovementInput[] = movements.map((m): StatementMovementInput => ({
    date: m.date,
    kind: m.direction === 'in' ? 'payment_in' : 'payment_out',
    description: m.title,
    reference: m.donor,
    amount: m.amount,
  }));

  const statement = computeAccountStatement(0, stmtInputs, from, to);
  const balanceNow = computeAccountStatement(0, stmtInputs, new Date(0), now).closingBalance;

  const periodIn = movements.filter((m) => m.direction === 'in' && inRange(m.date, from, to));
  const periodOut = movements.filter((m) => m.direction === 'out' && inRange(m.date, from, to));

  const sumOrigin = (o: FundOrigin) => sumMoney(periodIn.filter((m) => m.origin === o).map((m) => m.amount));
  const entriesByOrigin = { campaign: sumOrigin('campaign'), session: sumOrigin('session'), other: sumOrigin('other') };

  const detailMap = new Map<string, { origin: FundOrigin; amounts: number[] }>();
  for (const m of periodIn) {
    if (m.origin === 'other') continue;
    const label = m.originLabel ?? (m.origin === 'campaign' ? 'Campanha' : 'Sessão');
    const key = `${m.origin}|${label}`;
    const cur = detailMap.get(key) ?? { origin: m.origin, amounts: [] };
    cur.amounts.push(m.amount);
    detailMap.set(key, cur);
  }
  const entryDetail = [...detailMap.entries()]
    .map(([key, v]) => ({ origin: v.origin, label: key.slice(key.indexOf('|') + 1), total: sumMoney(v.amounts), count: v.amounts.length }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  const exitsByTitle = bucketize(periodOut.map((m) => ({ label: m.title, amount: m.amount })));
  const donors = bucketize(periodIn.map((m) => ({ label: m.donor ?? 'Não identificado', amount: m.amount })));

  const months = lastMonths(to, 12);
  const monthly = months.map((month) => {
    const ins = movements.filter((m) => m.direction === 'in' && monthKey(m.date) === month).map((m) => m.amount);
    const outs = movements.filter((m) => m.direction === 'out' && monthKey(m.date) === month).map((m) => m.amount);
    const i = sumMoney(ins);
    const o = sumMoney(outs);
    return { month, in: i, out: o, net: sumMoney([i, -o]) };
  });

  return {
    statement,
    balanceNow,
    entriesByOrigin,
    entryDetail,
    exitsByTitle,
    donors,
    monthly,
  };
}
