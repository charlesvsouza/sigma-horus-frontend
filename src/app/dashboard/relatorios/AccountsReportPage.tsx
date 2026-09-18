import { auth } from '@/lib/auth';
import { buildAccountsReport } from '@/lib/accounts-report';
import { loadAccountsReportRows, type AccountsReportVariant } from '@/lib/accounts-report-data';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import ContasReportClient from './ContasReportClient';

const LABELS: Record<AccountsReportVariant, { title: string; description: string; dateLabel: string }> = {
  'contas-a-receber': { title: 'Contas a receber', description: 'Contas em aberto a receber, por vencimento.', dateLabel: 'Vencimento' },
  'contas-a-pagar': { title: 'Contas a pagar', description: 'Contas em aberto a pagar, por vencimento.', dateLabel: 'Vencimento' },
  'contas-recebidas': { title: 'Contas recebidas', description: 'Pagamentos já recebidos, por data de recebimento.', dateLabel: 'Recebimento' },
  'contas-pagas': { title: 'Contas pagas', description: 'Pagamentos já efetuados, por data de pagamento.', dateLabel: 'Pagamento' },
};

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function AccountsReportPage({
  variant,
  searchParams,
}: {
  variant: AccountsReportVariant;
  searchParams: Promise<{ from?: string; to?: string; personId?: string; text?: string }>;
}) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const sp = await searchParams;

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

  const now = new Date();
  const from = sp.from ? new Date(`${sp.from}T00:00:00`) : monthStart(now);
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : now;

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, members, counterparties, rowsInput] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
      db.member.findMany({ where: { lodgeId: String(lodgeId) }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      db.counterparty.findMany({ where: { lodgeId: String(lodgeId) }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      loadAccountsReportRows(db, String(lodgeId), variant, role),
    ]);
    return { lodge, members, counterparties, rowsInput };
  });

  const report = buildAccountsReport(data.rowsInput, {
    from,
    to,
    personId: sp.personId || null,
    text: sp.text,
  });

  const labels = LABELS[variant];
  const people = [...data.members, ...data.counterparties].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ContasReportClient
      basePath={`/dashboard/relatorios/${variant}`}
      title={labels.title}
      description={labels.description}
      dateLabel={labels.dateLabel}
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      people={people}
      from={from.toISOString().slice(0, 10)}
      to={sp.to ?? now.toISOString().slice(0, 10)}
      personId={sp.personId ?? ''}
      text={sp.text ?? ''}
      report={report}
    />
  );
}
