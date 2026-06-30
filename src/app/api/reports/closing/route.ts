import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Suíte de relatórios de fechamento do veneralato (formato livro caixa):
// Balanço Financeiro, Balancete por plano de contas, Receitas×Despesas mensal,
// Livro Caixa, Cobranças e Saldo dos Associados. Base: Payments (caixa real),
// Accounts (vínculo ao plano de contas) e Invoices.
export async function GET(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const url = new URL(request.url);
  const now = new Date();
  const from = url.searchParams.get('from')
    ? new Date(url.searchParams.get('from') as string)
    : new Date(now.getFullYear(), 0, 1);
  const to = url.searchParams.get('to')
    ? new Date(`${url.searchParams.get('to')}T23:59:59`)
    : now;

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, payments, accounts, invoices] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, riteName: true, powerName: true } }),
      db.payment.findMany({
        where: { lodgeId: String(lodgeId) },
        include: {
          account: { select: { type: true, title: true, dueDate: true, chartAccount: { select: { code: true, name: true, category: true } } } },
          member: { select: { id: true, name: true } },
        },
        orderBy: { paidAt: 'asc' },
      }),
      db.account.findMany({
        where: { lodgeId: String(lodgeId) },
        include: { member: { select: { id: true, name: true } } },
      }),
      db.invoice.findMany({
        where: { lodgeId: String(lodgeId) },
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
        data: p.paidAt,
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
    .map((i) => ({ number: i.number, member: i.member?.name ?? '—', amount: Number(i.amount), dueDate: i.dueDate, status: i.status }));
  const totalCobrancas = cobrancas.reduce((s, c) => s + c.amount, 0);

  // ---------- 6. Saldo dos Irmãos ----------
  // Reconciliação por documento "até a data": débito = cobranças (Account
  // RECEIVABLE) já vencidas até `to`; crédito = pagamentos cujo recebível também
  // já venceu até `to`. Pagamento antecipado (conta a vencer depois de `to`) é
  // ignorado dos dois lados — antes distorcia o saldo (crédito sem o débito par).
  const byMember = new Map<string, { name: string; debito: number; credito: number }>();
  for (const a of data.accounts) {
    if (!a.member || a.type !== 'RECEIVABLE' || a.dueDate > to) continue;
    const m = byMember.get(a.member.id) ?? { name: a.member.name, debito: 0, credito: 0 };
    m.debito += Number(a.amount);
    byMember.set(a.member.id, m);
  }
  for (const p of data.payments) {
    if (!p.member || !isRevenue(p.account?.type) || p.paidAt > to) continue;
    // Pagamento ligado a recebível ainda não vencido (antecipado) fica de fora,
    // mantendo débito e crédito na mesma janela "até `to`".
    if (p.account?.dueDate && p.account.dueDate > to) continue;
    const m = byMember.get(p.member.id) ?? { name: p.member.name, debito: 0, credito: 0 };
    m.credito += Number(p.amount);
    byMember.set(p.member.id, m);
  }
  const saldoIrmaos = [...byMember.values()]
    .map((m) => ({ name: m.name, debito: m.debito, credito: m.credito, saldo: m.debito - m.credito }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
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
  });
}
