import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { parseBRDateTimeLocal } from '@/lib/br-time';
import { todayBR } from '@/lib/date-only';
import { asaasIdFromNote, buildFeeReport, type FeeRow } from '@/lib/fees-report';
import { isAsaasMode } from '@/lib/collection';
import TarifasClient from './TarifasClient';

// Server Component: tarifas reais cobradas pelo Asaas nos recebimentos do período (valor cobrado −
// líquido informado pelo Asaas) e quanto a loja absorveu. Base: os pagamentos baixados pelo Asaas.
export default async function TarifasPage(props: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const sp = await props.searchParams;

  if (!lodgeId) {
    return <main className="min-h-screen px-6 py-10"><p className="text-sm text-sand-dark">Sessão expirada.</p></main>;
  }
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'read');
  if (!access.ok) {
    return <main className="min-h-screen px-6 py-10"><p className="text-sm text-sand-dark">Acesso negado.</p></main>;
  }

  const today = todayBR();
  const fromStr = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? '') ? sp.from! : `${today.getUTCFullYear()}-01-01`;
  const toStr = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? '') ? sp.to! : today.toISOString().slice(0, 10);
  const from = parseBRDateTimeLocal(`${fromStr}T00:00:00`);
  const to = parseBRDateTimeLocal(`${toStr}T23:59:59`);

  const data = await withTenant(String(lodgeId), async (db) => {
    const lid = String(lodgeId);
    const [lodge, payments] = await Promise.all([
      db.lodge.findUnique({ where: { id: lid }, select: { name: true, crestUrl: true, collectionMode: true } }),
      db.payment.findMany({
        where: { lodgeId: lid, method: 'asaas', paidAt: { gte: from, lte: to } },
        select: { id: true, amount: true, paidAt: true, note: true, member: { select: { name: true } } },
        orderBy: { paidAt: 'desc' },
      }),
    ]);
    const asaasIds = payments.map((p) => asaasIdFromNote(p.note)).filter((x): x is string => Boolean(x));
    const invoices = asaasIds.length
      ? await db.invoice.findMany({
          where: { lodgeId: lid, asaasPaymentId: { in: asaasIds } },
          select: { asaasPaymentId: true, number: true, asaasBillingType: true, asaasFee: true },
        })
      : [];
    return { lodge, payments, invoices };
  });

  const byAsaasId = new Map(data.invoices.map((i) => [i.asaasPaymentId, i]));
  const rows: FeeRow[] = data.payments.map((p) => {
    const inv = byAsaasId.get(asaasIdFromNote(p.note) ?? '');
    return {
      id: p.id,
      date: p.paidAt,
      invoiceNumber: inv?.number ?? null,
      memberName: p.member?.name ?? null,
      method: inv?.asaasBillingType ?? null,
      gross: Number(p.amount),
      fee: inv?.asaasFee != null ? Number(inv.asaasFee) : null,
      passedOn: 0, // política atual: a loja absorve a tarifa
    };
  });

  const report = buildFeeReport(rows);

  return (
    <TarifasClient
      lodgeName={data.lodge?.name ?? ''}
      crestUrl={data.lodge?.crestUrl ?? null}
      asaasMode={isAsaasMode(data.lodge)}
      from={fromStr}
      to={toStr}
      report={{ ...report, outOfPolicy: report.outOfPolicy.map((r) => ({ ...r, date: r.date.toISOString() })) }}
      rows={rows.map((r) => ({ ...r, date: r.date.toISOString() }))}
    />
  );
}
