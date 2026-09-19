import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess, normalizeRole } from '@/lib/rbac';
import { donorDisplayName } from '@/lib/hospitalaria';
import { parseBRDateTimeLocal } from '@/lib/br-time';
import { todayBR } from '@/lib/date-only';
import { FUND_LABELS, isFundPurpose, type FundPurpose } from '@/lib/funds';
import {
  buildFundReport,
  type FundMovementRow,
  type FundStrayRow,
  type FundTransferRow,
} from '@/lib/funds-report';
import { computeFinancialAccountBalances } from '@/lib/financial-accounts';
import { sumMoney } from '@/lib/money';
import FundosClient from './FundosClient';

const BR = 'America/Sao_Paulo';
const fmtBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: BR });
const iso = (d: Date) => d.toISOString();

// Server Component: gestão de um fundo com caixa próprio (Tronco de Beneficência ou
// Doações e Contribuições) — saldo, extrato, entradas por origem, saídas, doadores,
// campanhas e conferência de lançamentos fora do caixa do fundo.
export default async function FundosPage(props: { searchParams: Promise<{ fund?: string; from?: string; to?: string }> }) {
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

  // Extrato, saídas e doadores são de gestão (Contas). O Membro vê só o saldo do Tronco,
  // no portal Hospitalaria.
  const byAccounts = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!byAccounts.ok) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Acesso negado.</p>
      </main>
    );
  }

  const canRecord = (
    await Promise.all([
      requireLodgeAccess(String(lodgeId), role, 'accounts', 'write'),
      requireLodgeAccess(String(lodgeId), role, 'campaigns', 'write'),
    ])
  ).some((a) => a.ok);

  const fund: FundPurpose = isFundPurpose(sp.fund) ? sp.fund : 'tronco';
  const today = todayBR();
  const fromStr = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? '') ? sp.from! : `${today.getUTCFullYear()}-01-01`;
  const toStr = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? '') ? sp.to! : today.toISOString().slice(0, 10);
  const from = parseBRDateTimeLocal(`${fromStr}T00:00:00`);
  const to = parseBRDateTimeLocal(`${toStr}T23:59:59`);

  const data = await withTenant(String(lodgeId), async (db) => {
    const lid = String(lodgeId);
    const [lodge, fundAccounts, members, recentSessions] = await Promise.all([
      db.lodge.findUnique({ where: { id: lid }, select: { name: true, crestUrl: true } }),
      db.financialAccount.findMany({ where: { lodgeId: lid, purpose: fund }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
      canRecord ? db.member.findMany({ where: { lodgeId: lid, status: 'active' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
      canRecord ? db.session.findMany({ where: { lodgeId: lid, date: { lte: new Date() } }, select: { id: true, title: true, date: true }, orderBy: { date: 'desc' }, take: 20 }) : Promise.resolve([]),
    ]);
    const ids = fundAccounts.map((f) => f.id);

    const paymentSelect = {
      id: true,
      amount: true,
      paidAt: true,
      method: true,
      bankAccountId: true,
      member: { select: { name: true } },
      bankAccount: { select: { name: true } },
      account: {
        select: {
          type: true,
          title: true,
          description: true,
          counterpartyName: true,
          sessionId: true,
          counterparty: { select: { name: true } },
          session: { select: { date: true } },
          chartAccount: { select: { name: true, fundPurpose: true, isSolidarity: true } },
        },
      },
    } as const;

    const [inCaixa, outside, transfers, campaigns] = await Promise.all([
      ids.length ? db.payment.findMany({ where: { lodgeId: lid, bankAccountId: { in: ids } }, select: paymentSelect }) : Promise.resolve([]),
      db.payment.findMany({
        // Sem conta (NULL) também é "fora do caixa": NOT IN descartaria NULL no SQL.
        where: { lodgeId: lid, account: { chartAccount: { fundPurpose: fund } }, OR: [{ bankAccountId: null }, { bankAccountId: { notIn: ids } }] },
        select: paymentSelect,
      }),
      ids.length
        ? db.accountTransfer.findMany({
            where: { lodgeId: lid, status: 'approved', OR: [{ fromId: { in: ids } }, { toId: { in: ids } }] },
            include: { from: { select: { name: true } }, to: { select: { name: true } } },
          })
        : Promise.resolve([]),
      fund === 'tronco'
        ? db.campaign.findMany({ where: { lodgeId: lid }, include: { donations: { select: { amount: true, receivedAt: true, paymentId: true } } }, orderBy: { createdAt: 'desc' } })
        : Promise.resolve([]),
    ]);

    const donationCampaign = new Map<string, string>();
    for (const c of campaigns) for (const dn of c.donations) if (dn.paymentId) donationCampaign.set(dn.paymentId, c.title);

    return { lodge, fundAccounts, members, recentSessions, ids, inCaixa, outside, transfers, campaigns, donationCampaign };
  });

  const idSet = new Set(data.ids);

  const movements: FundMovementRow[] = data.inCaixa.map((p) => {
    const dir: 'in' | 'out' = p.account?.type === 'RECEIVABLE' ? 'in' : 'out';
    const campaignTitle = data.donationCampaign.get(p.id);
    const origin = campaignTitle ? 'campaign' : p.account?.sessionId ? 'session' : 'other';
    const raw = dir === 'in' ? p.member?.name ?? p.account?.counterparty?.name ?? p.account?.counterpartyName ?? (p.method === 'donation' ? p.account?.description : null) ?? null : null;
    const isSolidarity = fund === 'tronco' || Boolean(p.account?.chartAccount?.isSolidarity);
    return {
      id: p.id,
      date: p.paidAt,
      direction: dir,
      amount: Number(p.amount),
      title: p.account?.title ?? 'Pagamento',
      category: p.account?.chartAccount?.name ?? 'Sem categoria',
      method: p.method,
      origin,
      originLabel: campaignTitle ?? (p.account?.session?.date ? `Sessão ${fmtBR(p.account.session.date)}` : null),
      // Quem doou só aparece para Administrador/Venerável/Tesoureiro (regra do Tronco).
      donor: donorDisplayName(raw, isSolidarity, role),
    };
  });

  const transferRows: FundTransferRow[] = data.transfers.flatMap((t) => {
    const rows: FundTransferRow[] = [];
    // Transferência entre dois caixas do mesmo fundo aparece nas duas pontas (líquido zero).
    if (idSet.has(t.toId)) rows.push({ id: `${t.id}:in`, date: t.date, direction: 'in', amount: Number(t.amount), note: t.note ?? null, counterpart: t.from.name });
    if (idSet.has(t.fromId)) rows.push({ id: `${t.id}:out`, date: t.date, direction: 'out', amount: Number(t.amount), note: t.note ?? null, counterpart: t.to.name });
    return rows;
  });

  const stray = (p: (typeof data.inCaixa)[number]): FundStrayRow => ({
    id: p.id,
    date: p.paidAt,
    direction: p.account?.type === 'RECEIVABLE' ? 'in' : 'out',
    amount: Number(p.amount),
    title: p.account?.title ?? 'Pagamento',
    where: p.bankAccount?.name ?? 'sem conta bancária/caixa',
  });
  const outsideCaixa = data.outside.map(stray);
  const foreignInCaixa = data.inCaixa.filter((p) => p.account?.chartAccount?.fundPurpose !== fund).map(stray);

  const openingBalance = computeFinancialAccountBalances(
    data.fundAccounts.map((f) => ({ id: f.id, openingBalance: Number(f.openingBalance) })),
    [],
    [],
  ).map((a) => a.saldo);
  const openingSum = sumMoney(openingBalance);

  const report = buildFundReport({ openingBalance: openingSum, movements, transfers: transferRows, outsideCaixa, foreignInCaixa, from, to });

  // Saldo de hoje por caixa do fundo (entradas − saídas + transferências aprovadas).
  const balances = computeFinancialAccountBalances(
    data.fundAccounts.map((f) => ({ id: f.id, openingBalance: Number(f.openingBalance) })),
    data.inCaixa.map((p) => ({ bankAccountId: p.bankAccountId, amount: Number(p.amount), accountType: p.account?.type ?? 'RECEIVABLE' })),
    data.transfers.map((t) => ({ fromId: t.fromId, toId: t.toId, amount: Number(t.amount) })),
  );
  const saldoById = new Map(balances.map((b) => [b.id, b.saldo]));

  const campaignRows = data.campaigns.map((c) => {
    const donated = c.donations.reduce((s, dn) => s + Number(dn.amount), 0);
    const inPeriod = c.donations.filter((dn) => dn.receivedAt >= from && dn.receivedAt <= to).reduce((s, dn) => s + Number(dn.amount), 0);
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      goal: c.goalAmount != null ? Number(c.goalAmount) : null,
      donated,
      donatedInPeriod: inPeriod,
      fundAllocated: Number(c.fundAllocated),
    };
  });

  return (
    <FundosClient
      fund={fund}
      fundLabels={FUND_LABELS}
      lodgeName={data.lodge?.name ?? ''}
      crestUrl={data.lodge?.crestUrl ?? null}
      from={fromStr}
      to={toStr}
      accounts={data.fundAccounts.map((f) => ({ id: f.id, name: f.name, active: f.active, balance: saldoById.get(f.id) ?? Number(f.openingBalance) }))}
      report={{
        ...report,
        strays: {
          outsideCaixa: { net: report.strays.outsideCaixa.net, rows: report.strays.outsideCaixa.rows.map((r) => ({ ...r, date: iso(r.date) })) },
          foreignInCaixa: { net: report.strays.foreignInCaixa.net, rows: report.strays.foreignInCaixa.rows.map((r) => ({ ...r, date: iso(r.date) })) },
        },
      }}
      campaigns={campaignRows}
      canRecord={canRecord}
      members={data.members}
      sessions={data.recentSessions.map((x) => ({ id: x.id, label: `${fmtBR(x.date)} — ${x.title}` }))}
      canSeeDonors={role === 'admin' || role === 'venerable' || role === 'treasurer'}
    />
  );
}
