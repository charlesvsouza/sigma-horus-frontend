import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getProjectedCashFlow } from '@/lib/cashflow';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  const flow = await withTenant(String(lodgeId), (db) => getProjectedCashFlow(db, String(lodgeId)));
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

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <div className="space-y-4">
            {flow.buckets.map((b) => (
              <div key={b.label} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-sand-light">{b.label}</p>
                  <p className={`text-sm font-semibold ${b.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {b.net >= 0 ? '+' : ''}{brl(b.net)}
                  </p>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-sand-dark">
                    <span className="w-16 shrink-0">A receber</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[6%]">
                      <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${(b.receivable / maxAbs) * 100}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right tabular-nums">{brl(b.receivable)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-sand-dark">
                    <span className="w-16 shrink-0">A pagar</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[6%]">
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
      </div>
    </main>
  );
}
