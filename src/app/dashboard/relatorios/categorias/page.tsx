import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess, normalizeRole } from '@/lib/rbac';
import { donorDisplayName } from '@/lib/hospitalaria';
import { parseBRDateTimeLocal } from '@/lib/br-time';
import { todayBR } from '@/lib/date-only';
import { fundChartWhere, isFundPurpose } from '@/lib/funds';
import { buildCategoryLedger, type LedgerPaymentInput, type LedgerOpenItemInput, type RequestedChart } from '@/lib/category-ledger';
import CategoriasClient from './CategoriasClient';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Razão por categoria: tudo o que foi lançado nas categorias escolhidas (Tronco,
// Doações, Mensalidades, qualquer uma), lançamento a lançamento, com saldo acumulado.
// Sem categoria marcada = todas. `?fund=tronco|donations` pré-seleciona as categorias do fundo.
// `?open=1` inclui também cobranças em aberto (pendentes, sem Payment ainda) na lista —
// elas nunca entram no saldo, só dão o quadro completo da categoria.
export default async function CategoriasPage(props: {
  searchParams: Promise<{ cat?: string; fund?: string; from?: string; to?: string; bank?: string; dir?: string; open?: string }>;
}) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = normalizeRole(session?.user?.role);
  const sp = await props.searchParams;

  if (!lodgeId) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Sessão expirada.</p>
      </main>
    );
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Acesso negado.</p>
      </main>
    );
  }

  const today = todayBR();
  const fromStr = ISO_DAY.test(sp.from ?? '') ? sp.from! : `${today.getUTCFullYear()}-01-01`;
  const toStr = ISO_DAY.test(sp.to ?? '') ? sp.to! : today.toISOString().slice(0, 10);
  const from = parseBRDateTimeLocal(`${fromStr}T00:00:00`);
  const to = parseBRDateTimeLocal(`${toStr}T23:59:59`);
  const direction: 'all' | 'in' | 'out' = sp.dir === 'in' || sp.dir === 'out' ? sp.dir : 'all';
  const includeOpen = sp.open === '1';

  const data = await withTenant(String(lodgeId), async (db) => {
    const lid = String(lodgeId);
    const [lodge, charts, banks] = await Promise.all([
      db.lodge.findUnique({ where: { id: lid }, select: { name: true, crestUrl: true } }),
      db.chartAccount.findMany({
        where: { lodgeId: lid },
        select: { id: true, code: true, name: true, type: true, category: true, fundPurpose: true, isSolidarity: true, isDues: true },
        orderBy: { code: 'asc' },
      }),
      db.financialAccount.findMany({ where: { lodgeId: lid }, select: { id: true, name: true, active: true }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    ]);

    // Categorias escolhidas: as da URL (só as da loja) ou, com ?fund=, as do fundo. Vazio = todas.
    const valid = new Set(charts.map((c) => c.id));
    let selectedIds = (sp.cat ?? '').split(',').filter((id) => valid.has(id));
    if (selectedIds.length === 0 && isFundPurpose(sp.fund)) {
      const fundCharts = await db.chartAccount.findMany({ where: { lodgeId: lid, ...fundChartWhere(sp.fund) }, select: { id: true } });
      selectedIds = fundCharts.map((c) => c.id);
    }
    const bankId = banks.some((b) => b.id === sp.bank) ? sp.bank! : null;

    const payments = await db.payment.findMany({
      where: {
        lodgeId: lid,
        paidAt: { lte: to },
        ...(bankId ? { bankAccountId: bankId } : {}),
        ...(selectedIds.length ? { account: { chartAccountId: { in: selectedIds } } } : {}),
      },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        method: true,
        member: { select: { name: true } },
        bankAccount: { select: { name: true } },
        account: {
          select: {
            type: true,
            title: true,
            counterpartyName: true,
            counterparty: { select: { name: true } },
            chartAccount: { select: { id: true, code: true, name: true, category: true, isSolidarity: true } },
          },
        },
      },
    });

    const openAccounts = includeOpen
      ? await db.account.findMany({
          where: {
            lodgeId: lid,
            status: { not: 'paid' },
            dueDate: { lte: to },
            ...(bankId ? { bankAccountId: bankId } : {}),
            ...(selectedIds.length ? { chartAccountId: { in: selectedIds } } : {}),
          },
          select: {
            id: true,
            amount: true,
            dueDate: true,
            type: true,
            title: true,
            counterpartyName: true,
            member: { select: { name: true } },
            counterparty: { select: { name: true } },
            bankAccount: { select: { name: true } },
            chartAccount: { select: { id: true, code: true, name: true, category: true, isSolidarity: true } },
          },
        })
      : [];

    return { lodge, charts, banks, selectedIds, bankId, payments, openAccounts };
  });

  const inputs: LedgerPaymentInput[] = data.payments.map((p) => {
    const chart = p.account?.chartAccount ?? null;
    const raw = p.member?.name ?? p.account?.counterparty?.name ?? p.account?.counterpartyName ?? null;
    return {
      id: p.id,
      paidAt: p.paidAt,
      amount: Number(p.amount),
      accountType: p.account?.type ?? null,
      title: p.account?.title ?? 'Pagamento',
      // Quem doou ao Tronco só aparece para Administrador/Venerável/Tesoureiro.
      person: donorDisplayName(raw, chart?.isSolidarity ?? false, role),
      bank: p.bankAccount?.name ?? null,
      method: p.method,
      chart: chart ? { id: chart.id, code: chart.code, name: chart.name, category: chart.category } : null,
    };
  });

  const openInputs: LedgerOpenItemInput[] = data.openAccounts.map((a) => {
    const chart = a.chartAccount ?? null;
    const raw = a.member?.name ?? a.counterparty?.name ?? a.counterpartyName ?? null;
    return {
      id: a.id,
      dueDate: a.dueDate,
      amount: Number(a.amount),
      accountType: a.type,
      title: a.title,
      person: donorDisplayName(raw, chart?.isSolidarity ?? false, role),
      bank: a.bankAccount?.name ?? null,
      chart: chart ? { id: chart.id, code: chart.code, name: chart.name, category: chart.category } : null,
    };
  });

  // Categorias marcadas explicitamente no filtro: aparecem no resultado mesmo sem
  // nenhum lançamento, com "sem movimentação" em vez de sumir da lista.
  const requestedCharts: RequestedChart[] = data.charts
    .filter((c) => data.selectedIds.includes(c.id))
    .map((c) => ({ id: c.id, code: c.code, name: c.name, category: c.category ?? 'Sem grupo' }));

  const ledger = buildCategoryLedger(inputs, from, to, direction, openInputs, requestedCharts);

  return (
    <CategoriasClient
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      from={fromStr}
      to={toStr}
      direction={direction}
      includeOpen={includeOpen}
      bankId={data.bankId}
      selectedIds={data.selectedIds}
      charts={data.charts.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        type: c.type,
        group: c.category ?? 'Sem grupo',
        fund: c.fundPurpose === 'tronco' || c.isSolidarity ? 'tronco' : c.fundPurpose === 'donations' ? 'donations' : null,
        dues: c.isDues,
      }))}
      banks={data.banks}
      ledger={{
        totals: ledger.totals,
        groups: ledger.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, date: r.date.toISOString() })) })),
      }}
    />
  );
}
