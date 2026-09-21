import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess, normalizeRole } from '@/lib/rbac';
import { donorDisplayName } from '@/lib/hospitalaria';
import { parseBRDateTimeLocal } from '@/lib/br-time';
import { todayBR } from '@/lib/date-only';
import { FUND_LABELS, fundChartWhere, isFundPurpose, type FundPurpose } from '@/lib/funds';
import { buildFundReport, type FundMovementRow } from '@/lib/funds-report';
import FundosClient from './FundosClient';

const BR = 'America/Sao_Paulo';
const fmtBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: BR });

// Server Component: gestão de um fundo (Tronco de Beneficência ou Doações e Contribuições)
// — saldo, extrato, entradas por origem, saídas, doadores e campanhas. O fundo é uma
// CATEGORIA do plano de contas: entram todos os pagamentos lançados nas categorias dele,
// em qualquer banco/caixa da loja.
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
    const [lodge, payments, members, recentSessions, bankAccounts] = await Promise.all([
      db.lodge.findUnique({ where: { id: lid }, select: { name: true, crestUrl: true } }),
      db.payment.findMany({
        where: { lodgeId: lid, account: { chartAccount: fundChartWhere(fund) } },
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
              description: true,
              counterpartyName: true,
              sessionId: true,
              counterparty: { select: { name: true } },
              session: { select: { date: true } },
              chartAccount: { select: { name: true } },
            },
          },
        },
      }),
      canRecord ? db.member.findMany({ where: { lodgeId: lid, status: 'active' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
      canRecord ? db.session.findMany({ where: { lodgeId: lid, date: { lte: new Date() } }, select: { id: true, title: true, date: true }, orderBy: { date: 'desc' }, take: 20 }) : Promise.resolve([]),
      canRecord ? db.financialAccount.findMany({ where: { lodgeId: lid, active: true }, select: { id: true, name: true, isDefault: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }) : Promise.resolve([]),
    ]);

    const campaigns =
      fund === 'tronco'
        ? await db.campaign.findMany({ where: { lodgeId: lid }, include: { donations: { select: { amount: true, receivedAt: true, paymentId: true } } }, orderBy: { createdAt: 'desc' } })
        : [];

    const donationCampaign = new Map<string, string>();
    for (const c of campaigns) for (const dn of c.donations) if (dn.paymentId) donationCampaign.set(dn.paymentId, c.title);

    return { lodge, payments, members, recentSessions, bankAccounts, campaigns, donationCampaign };
  });

  const movements: FundMovementRow[] = data.payments.map((p) => {
    const dir: 'in' | 'out' = p.account?.type === 'RECEIVABLE' ? 'in' : 'out';
    const campaignTitle = data.donationCampaign.get(p.id);
    const origin = campaignTitle ? 'campaign' : p.account?.sessionId ? 'session' : 'other';
    const raw = dir === 'in' ? p.member?.name ?? p.account?.counterparty?.name ?? p.account?.counterpartyName ?? (p.method === 'donation' ? p.account?.description : null) ?? null : null;
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
      donor: donorDisplayName(raw, fund === 'tronco', role),
    };
  });

  const report = buildFundReport({ movements, from, to });

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
      accounts={data.bankAccounts}
      report={report}
      campaigns={campaignRows}
      canRecord={canRecord}
      members={data.members}
      sessions={data.recentSessions.map((x) => ({ id: x.id, label: `${fmtBR(x.date)} — ${x.title}` }))}
      canSeeDonors={role === 'admin' || role === 'venerable' || role === 'treasurer'}
    />
  );
}
