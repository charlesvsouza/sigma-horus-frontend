import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getAccountBalance } from '@/lib/asaas';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { asaasSituation, summarizeAsaasRows } from '@/lib/asaas-panel';
import { asaasIdFromNote } from '@/lib/fees-report';
import { isAsaasMode } from '@/lib/collection';
import { todayBR } from '@/lib/date-only';
import AsaasPanelClient from './AsaasPanelClient';

const DAY_MS = 86_400_000;
const isYmd = (s?: string) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '');

// Server Component: acompanhamento das cobranças emitidas no Asaas (aguardando, vencidas, pagas e
// baixadas), o saldo que ainda está na conta do Asaas e as tarifas do período.
export default async function AsaasPanelPage(props: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const sp = await props.searchParams;
  if (!lodgeId) return <main className="min-h-screen px-6 py-10"><p className="text-sm text-sand-dark">Sessão expirada.</p></main>;
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'read');
  if (!access.ok) return <main className="min-h-screen px-6 py-10"><p className="text-sm text-sand-dark">Acesso negado.</p></main>;

  // Período pelo vencimento: 90 dias para trás e 60 para a frente, a menos que o usuário escolha.
  const today = todayBR();
  const fromStr = isYmd(sp.from) ? sp.from! : new Date(today.getTime() - 90 * DAY_MS).toISOString().slice(0, 10);
  const toStr = isYmd(sp.to) ? sp.to! : new Date(today.getTime() + 60 * DAY_MS).toISOString().slice(0, 10);
  const from = new Date(`${fromStr}T00:00:00Z`);
  const to = new Date(`${toStr}T00:00:00Z`);

  const data = await withTenant(lodgeId, async (db) => {
    const [lodge, invoices] = await Promise.all([
      db.lodge.findUnique({
        where: { id: lodgeId },
        select: { name: true, crestUrl: true, collectionMode: true, asaasApiKeyEnc: true, asaasEnv: true, asaasSettlementAccountId: true, asaasAutoEmit: true, asaasWebhookToken: true },
      }),
      db.invoice.findMany({
        where: { lodgeId, asaasPaymentId: { not: null }, dueDate: { gte: from, lte: to } },
        select: {
          id: true, number: true, amount: true, dueDate: true, status: true, asaasPaymentId: true, asaasInvoiceUrl: true,
          asaasBillingType: true, asaasFee: true, asaasNetValue: true, member: { select: { name: true } },
        },
        orderBy: { dueDate: 'desc' },
        take: 1000,
      }),
    ]);
    // Data da baixa: o Payment do Asaas leva o id da cobrança na observação.
    const anyPaid = invoices.some((i) => i.status === 'paid');
    const payments = anyPaid
      ? await db.payment.findMany({ where: { lodgeId, method: 'asaas' }, select: { note: true, paidAt: true }, orderBy: { paidAt: 'desc' }, take: 3000 })
      : [];
    const settlement = lodge?.asaasSettlementAccountId
      ? await db.financialAccount.findUnique({ where: { id: lodge.asaasSettlementAccountId }, select: { name: true } })
      : null;
    return { lodge, invoices, payments, settlement };
  });

  const paidAtById = new Map<string, Date>();
  for (const p of data.payments) {
    const id = asaasIdFromNote(p.note);
    if (id && !paidAtById.has(id)) paidAtById.set(id, p.paidAt);
  }

  const rows = data.invoices.map((i) => ({
    id: i.id,
    number: i.number,
    memberName: i.member?.name ?? null,
    amount: Number(i.amount),
    dueDate: i.dueDate.toISOString(),
    situation: asaasSituation(i.status, i.dueDate, today),
    method: i.asaasBillingType ?? null,
    fee: i.asaasFee != null ? Number(i.asaasFee) : null,
    net: i.asaasNetValue != null ? Number(i.asaasNetValue) : null,
    paidAt: paidAtById.get(i.asaasPaymentId!)?.toISOString() ?? null,
    url: i.asaasInvoiceUrl ?? null,
  }));

  const asaasMode = isAsaasMode(data.lodge);
  const config = buildLodgeAsaasConfig(data.lodge);
  const balance = asaasMode && config ? await getAccountBalance(config, 6000).catch(() => null) : null;

  return (
    <AsaasPanelClient
      lodgeName={data.lodge?.name ?? ''}
      crestUrl={data.lodge?.crestUrl ?? null}
      issuedBy={session?.user?.name ?? null}
      asaasMode={asaasMode}
      env={data.lodge?.asaasEnv ?? 'sandbox'}
      connected={Boolean(config)}
      webhookOk={Boolean(data.lodge?.asaasWebhookToken)}
      autoEmit={Boolean(data.lodge?.asaasAutoEmit)}
      settlementName={data.settlement?.name ?? null}
      balance={balance}
      from={fromStr}
      to={toStr}
      summary={summarizeAsaasRows(rows)}
      rows={rows}
    />
  );
}
