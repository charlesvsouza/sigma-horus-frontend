'use client';

import { Badge, EmptyState } from '@/components/ui';
import { memberStatusLabel } from '@/lib/member-status';

interface Row {
  memberId: string;
  memberName: string;
  memberStatus: string;
  openCount: number;
  totalAmount: number;
  oldestDueDate: string;
  daysOverdue: number;
  art002: boolean;
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function InadimplenciaClient({ rows }: { rows: Row[] }) {
  const art002Count = rows.filter((r) => r.art002).length;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Inadimplência — Art. 002</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Mensalidades em aberto por membro. O membro é enquadrado no Art. 002 quando a mensalidade em aberto mais
            antiga passa de 60 dias sem pagamento — o status é atualizado automaticamente pelo sistema.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Membros com mensalidade em aberto</p>
            <p className="mt-3 text-2xl font-semibold text-sand-light">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Enquadrados no Art. 002 (&gt; 60 dias)</p>
            <p className="mt-3 text-2xl font-semibold text-rose-300">{art002Count}</p>
          </div>
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Total em aberto</p>
            <p className="mt-3 text-2xl font-semibold text-gold">{brl(rows.reduce((s, r) => s + r.totalAmount, 0))}</p>
          </div>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Membros em aberto</h2>
          <div className="mt-5 space-y-3">
            {rows.length === 0 ? (
              <EmptyState title="Nenhuma mensalidade em aberto" description="Todos os membros estão em dia com a mensalidade." />
            ) : rows.map((row) => (
              <div key={row.memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-sand-light">{row.memberName}</p>
                  <p className="mt-1 text-xs text-sand-dark">
                    {row.openCount} mensalidade{row.openCount > 1 ? 's' : ''} em aberto • vencimento mais antigo em{' '}
                    {new Date(row.oldestDueDate).toLocaleDateString('pt-BR')} • situação atual: {memberStatusLabel(row.memberStatus)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-right text-xs text-sand-dark tabular-nums">{brl(row.totalAmount)}</span>
                  <Badge variant={row.art002 ? 'overdue' : 'warning'}>
                    {row.art002 ? `Art. 002 — ${row.daysOverdue} dias` : `${row.daysOverdue} dias em aberto`}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
