import { withTenant } from '@/lib/prisma';
import { reconcileMemberBalances } from '@/lib/closing';

// Computação da suíte de fechamento do veneralato (formato livro caixa):
// Balanço, Balancete, Receitas×Despesas mensal, Livro Caixa, Cobranças e Saldo
// dos Irmãos. Extraída da rota para ser reusada pelo Server Component da página.
// Base: Payments (caixa real), Accounts (vínculo ao plano de contas) e Invoices.
export async function getClosingReport(lodgeId: string, fromParam: string | null, toParam: string | null) {
  const now = new Date();
  const from = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), 0, 1);
  const to = toParam ? new Date(`${toParam}T23:59:59`) : now;

  const data = await withTenant(lodgeId, async (db) => {
    const [lodge, payments, accounts, invoices] = await Promise.all([
      db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true, riteName: true, powerName: true } }),
      db.payment.findMany({
        where: { lodgeId },
        include: {
          account: { select: { type: true, title: true, dueDate: true, chartAccount: { select: { code: true, name: true, category: true } } } },
          member: { select: { id: true, name: true } },
        },
        orderBy: { paidAt: 'asc' },
      }),
      db.account.findMany({
        where: { lodgeId },
        include: { member: { select: { id: true, name: true } } },
      }),
      db.invoice.findMany({
        where: { lodgeId },
        include: { member: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
      }),
    ]);
    return { lodge, payments, accounts, invoices };
  });

  const inPeriod = (d: Date) => d >= from && d <= to;
  const isRevenue = (t?: string) => t === 'RECEIVABLE';

  // ---------- 1. Balanço Financeiro + 2. Balancete ----------
  type Group = { code: string; name: string; category: string; type: 'REVENUE' | 'EXPENSE'; prior: number; period: number };
  const groups = new Map<string, Group>();
  const keyOf = (p: (typeof data.payments)[number]) => {
    const ca = p.account?.chartAccount;
    const type = isRevenue(p.account?.type) ? 'REVENUE' : 'EXPENSE';
    const code = ca?.code ?? (type === 'REVENUE' ? '1.0.00' : '2.0.00');
    const name = ca?.name ?? (p.account?.title ?? 'Sem classificação');
    const category = ca?.category ?? 'Sem grupo';
    return { k: `${type}:${code}:${name}`, code, name, category, type: type as 'REVENUE' | 'EXPENSE' };
  };

  let priorRevenue = 0, priorExpense = 0, periodRevenue = 0, periodExpense = 0;
  for (const p of data.payments) {
    const meta = keyOf(p);
    const g = groups.get(meta.k) ?? { code: meta.code, name: meta.name, category: meta.category, type: meta.type, prior: 0, period: 0 };
    const amt = Number(p.amount);
    if (inPeriod(p.paidAt)) {
      g.period += amt;
      if (meta.type === 'REVENUE') periodRevenue += amt; else periodExpense += amt;
    } else if (p.paidAt < from) {
      g.prior += amt;
      if (meta.type === 'REVENUE') priorRevenue += amt; else priorExpense += amt;
    }
    groups.set(meta.k, g);
  }

  const saldoAnterior = priorRevenue - priorExpense;
  const saldoAtual = saldoAnterior + periodRevenue - periodExpense;

  const balanco = {
    receitas: [...groups.values()].filter((g) => g.type === 'REVENUE' && g.period !== 0)
      .map((g) => ({ code: g.code, name: g.name, value: g.period, pct: periodRevenue ? (g.period / periodRevenue) * 100 : 0 }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    despesas: [...groups.values()].filter((g) => g.type === 'EXPENSE' && g.period !== 0)
      .map((g) => ({ code: g.code, name: g.name, value: g.period, pct: periodExpense ? (g.period / periodExpense) * 100 : 0 }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    somaReceitas: periodRevenue,
    somaDespesas: periodExpense,
    saldoAnterior,
    saldoAtual,
  };

  const balancete = [...groups.values()]
    .filter((g) => g.prior !== 0 || g.period !== 0)
    .map((g) => {
      const debitos = g.type === 'EXPENSE' ? g.period : 0;
      const creditos = g.type === 'REVENUE' ? g.period : 0;
      const saldoAnt = g.prior;
      const saldoAt = saldoAnt + g.period;
      return { code: g.code, name: g.name, category: g.category, type: g.type, saldoAnterior: saldoAnt, debitos, creditos, saldoAtual: saldoAt };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  // ---------- 3. Receitas × Despesas mensal ----------
  const monthly = new Map<string, { receita: number; despesa: number }>();
  for (const p of data.payments) {
    if (!inPeriod(p.paidAt)) continue;
    const k = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, '0')}`;
    const m = monthly.get(k) ?? { receita: 0, despesa: 0 };
    if (isRevenue(p.account?.type)) m.receita += Number(p.amount); else m.despesa += Number(p.amount);
    monthly.set(k, m);
  }
  const receitasDespesas = [...monthly.entries()].sort().map(([mes, v]) => ({ mes, ...v }));

  // ---------- 4. Livro Caixa ----------
  let running = saldoAnterior;
  const livroCaixa = data.payments
    .filter((p) => inPeriod(p.paidAt))
    .map((p) => {
      const rev = isRevenue(p.account?.type);
      const value = rev ? Number(p.amount) : -Number(p.amount);
      running += value;
      return {
        data: p.paidAt.toISOString(),
        nome: p.member?.name ?? p.account?.title ?? '—',
        plano: p.account?.chartAccount?.name ?? '—',
        historico: p.note ?? p.account?.title ?? '',
        value,
        saldo: running,
      };
    });

  // ---------- 5. Cobranças em geral ----------
  const cobrancas = data.invoices
    .filter((i) => inPeriod(i.dueDate))
    .map((i) => ({ number: i.number, member: i.member?.name ?? '—', amount: Number(i.amount), dueDate: i.dueDate.toISOString(), status: i.status }));
  const totalCobrancas = cobrancas.reduce((s, c) => s + c.amount, 0);

  // ---------- 6. Saldo dos Irmãos ----------
  const saldoIrmaos = reconcileMemberBalances(
    data.accounts
      .filter((a) => a.member)
      .map((a) => ({ memberId: a.member!.id, memberName: a.member!.name, type: a.type, amount: Number(a.amount), dueDate: a.dueDate })),
    data.payments
      .filter((p) => p.member)
      .map((p) => ({ memberId: p.member!.id, memberName: p.member!.name, amount: Number(p.amount), paidAt: p.paidAt, accountType: p.account?.type ?? null, accountDueDate: p.account?.dueDate ?? null })),
    to,
  );

  return {
    meta: {
      lodge: data.lodge?.name ?? 'Loja',
      rite: data.lodge?.riteName ?? null,
      power: data.lodge?.powerName ?? null,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    },
    balanco,
    balancete,
    receitasDespesas,
    livroCaixa,
    cobrancas: { items: cobrancas, total: totalCobrancas },
    saldoIrmaos,
  };
}
