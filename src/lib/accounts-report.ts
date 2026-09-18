// Lógica pura dos relatórios de Contas a Receber/Pagar/Recebidas/Pagas —
// separada da rota pra ser testável sem Prisma, mesmo espírito de
// financial-accounts.ts/attendance-report.ts. As telas "abertas" (a
// receber/a pagar) filtram por data de VENCIMENTO da Account; as "liquidadas"
// (recebidas/pagas) filtram por data do PAGAMENTO — uma linha por Payment, não
// por Account, porque uma conta pode ser paga em parcelas em datas diferentes.

export interface AccountReportRowInput {
  id: string;
  date: Date; // vencimento (aberta) ou data do pagamento (liquidada)
  personId: string | null; // memberId ou counterpartyId, para o filtro "pessoa"
  personName: string | null; // já deve vir mascarado (ver lib/hospitalaria.ts) quando aplicável
  description: string;
  category: string | null; // nome da ChartAccount
  amount: number;
}

export interface AccountReportRow extends Omit<AccountReportRowInput, 'date'> {
  date: string; // ISO
}

export interface AccountReportFilters {
  from: Date;
  to: Date;
  personId?: string | null; // undefined/null/'' = todos
  text?: string; // busca em descrição/categoria
  amountMin?: number;
  amountMax?: number;
}

export interface AccountReport {
  rows: AccountReportRow[];
  total: number;
}

export function buildAccountsReport(rows: AccountReportRowInput[], filters: AccountReportFilters): AccountReport {
  const text = filters.text?.trim().toLowerCase();

  const filtered = rows
    .filter((r) => r.date >= filters.from && r.date <= filters.to)
    .filter((r) => !filters.personId || r.personId === filters.personId)
    .filter((r) => !text || r.description.toLowerCase().includes(text) || (r.category ?? '').toLowerCase().includes(text))
    .filter((r) => filters.amountMin == null || r.amount >= filters.amountMin)
    .filter((r) => filters.amountMax == null || r.amount <= filters.amountMax)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const out = filtered.map((r) => ({ ...r, date: r.date.toISOString() }));
  const total = out.reduce((s, r) => s + r.amount, 0);
  return { rows: out, total };
}
