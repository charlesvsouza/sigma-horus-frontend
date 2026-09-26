import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getProjectedCashFlow } from '@/lib/cashflow';
import { brl } from '@/lib/currency';
import { csvNumber } from '@/lib/csv';
import { ReportActions, ReportDocument } from '@/components/report/report-document';

const fmt = (d: Date) => d.toLocaleDateString('pt-BR');

// Server Component: fluxo de caixa projetado, direto do que já está lançado
// (contas não pagas), sem gráfico/lib externa — mesmo padrão simples do resto
// dos relatórios financeiros.
export default async function FluxoCaixaPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

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

  const [flow, lodge] = await withTenant(String(lodgeId), (db) =>
    Promise.all([
      getProjectedCashFlow(db, String(lodgeId)),
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
    ]),
  );
  const startingNote =
    flow.startingBalance != null
      ? `Saldo inicial: ${brl(flow.startingBalance)} (último fechamento de caixa, em ${fmt(flow.startingBalanceDate!)})`
      : 'Sem fechamento de caixa registrado: projeção a partir de zero (só o líquido do período)';
  const csvRows: unknown[][] = [
    ['Período', 'A receber', 'A pagar', 'Líquido', 'Saldo acumulado projetado'],
    ...flow.buckets.map((b) => [b.label, csvNumber(b.receivable), csvNumber(b.payable), csvNumber(b.net), csvNumber(b.cumulative)]),
  ];
  const totalReceivable = flow.buckets.reduce((s, b) => s + b.receivable, 0);
  const totalPayable = flow.buckets.reduce((s, b) => s + b.payable, 0);
  const maxAbs = Math.max(1, ...flow.buckets.map((b) => Math.max(b.receivable, b.payable)));

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Fluxo de caixa projetado</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Com base nas contas já lançadas e ainda não pagas — mostra se o caixa aperta antes de acontecer.
            {flow.startingBalance != null ? (
              <> Ponto de partida: saldo do último fechamento de caixa ({brl(flow.startingBalance)}, em {fmt(flow.startingBalanceDate!)}).</>
            ) : (
              <> Sem fechamento de caixa registrado ainda — a projeção começa do zero (só o líquido do período, não o caixa total).</>
            )}
          </p>
        </div>

        <ReportActions disabled={flow.buckets.length === 0} csv={{ filename: `fluxo_caixa_projetado_${new Date().toISOString().slice(0, 10)}`, rows: csvRows }} />

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="space-y-4">
            {flow.buckets.map((b) => (
              <div key={b.label} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-sand-light">{b.label}</p>
                  <p className={`text-sm font-semibold ${b.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {b.net >= 0 ? '+' : ''}{brl(b.net)}
                  </p>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-sand-dark">
                    <span className="w-16 shrink-0">A receber</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/6">
                      <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${(b.receivable / maxAbs) * 100}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right tabular-nums">{brl(b.receivable)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-sand-dark">
                    <span className="w-16 shrink-0">A pagar</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/6">
                      <div className="h-full rounded-full bg-rose-400/70" style={{ width: `${(b.payable / maxAbs) * 100}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right tabular-nums">{brl(b.payable)}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-sand-dark">Saldo acumulado projetado: <span className={b.cumulative >= 0 ? 'text-sand-light' : 'text-rose-300'}>{brl(b.cumulative)}</span></p>
              </div>
            ))}
          </div>
        </section>

        <ReportDocument
          printOnly
          lodgeName={lodge?.name ?? 'Loja'}
          crestUrl={lodge?.crestUrl ?? null}
          title="Fluxo de caixa projetado"
          details={['Contas lançadas e ainda não pagas', startingNote]}
          issuedBy={session?.user?.name ?? null}
        >
          <table>
            <thead>
              <tr>
                <th className="text-left">Período</th>
                <th className="num">A receber</th>
                <th className="num">A pagar</th>
                <th className="num">Líquido</th>
                <th className="num">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {flow.buckets.map((b) => (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  <td className="num">{brl(b.receivable)}</td>
                  <td className="num">{brl(b.payable)}</td>
                  <td className="num">{brl(b.net)}</td>
                  <td className="num">{brl(b.cumulative)}</td>
                </tr>
              ))}
              <tr className="rpt-total">
                <td>Total do período projetado</td>
                <td className="num">{brl(totalReceivable)}</td>
                <td className="num">{brl(totalPayable)}</td>
                <td className="num">{brl(totalReceivable - totalPayable)}</td>
                <td className="num">{flow.buckets.length ? brl(flow.buckets[flow.buckets.length - 1].cumulative) : ''}</td>
              </tr>
            </tbody>
          </table>
        </ReportDocument>
      </div>
    </main>
  );
}
