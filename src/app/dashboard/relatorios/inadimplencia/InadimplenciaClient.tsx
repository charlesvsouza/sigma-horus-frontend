'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, inputClass } from '@/components/ui';
import { memberStatusLabel } from '@/lib/member-status';

interface LateCharge { fee: number; interest: number; total: number; }
interface Row {
  memberId: string;
  memberName: string;
  memberStatus: string;
  openCount: number;
  totalAmount: number;
  oldestDueDate: string;
  daysOverdue: number;
  art002: boolean;
  lateCharge: LateCharge;
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function RenegotiateForm({ memberId, onDone }: { memberId: string; onDone: () => void }) {
  const [firstDueDate, setFirstDueDate] = useState('');
  const [applyLateCharge, setApplyLateCharge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/members/${memberId}/renegotiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstDueDate: firstDueDate || undefined, applyLateCharge }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) onDone();
    else setError(data.error ?? 'Erro ao renegociar.');
  }

  return (
    <div className="mt-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
      {error ? <p className="mb-2 text-xs text-rose-300">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-sand-dark">
          1º vencimento
          <input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} className={`ml-2 ${inputClass}`} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-sand-dark">
          <input type="checkbox" checked={applyLateCharge} onChange={(e) => setApplyLateCharge(e.target.checked)} />
          Incluir multa/juros no total
        </label>
        <button onClick={() => void submit()} disabled={busy} className="rounded-full bg-gold px-4 py-1.5 text-xs font-medium text-sigma-blue-deep hover:bg-gold-light disabled:opacity-40">
          {busy ? 'Gerando…' : 'Confirmar parcelamento'}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-sand-dark">
        Redistribui o valor em aberto (mensalidades vencidas) nas mesmas contas, com vencimentos mensais a partir da
        data acima. O Art. 002 deixa de contar assim que os vencimentos ficam no futuro.
      </p>
    </div>
  );
}

export default function InadimplenciaClient({ rows, canRenegotiate }: { rows: Row[]; canRenegotiate: boolean }) {
  const router = useRouter();
  const art002Count = rows.filter((r) => r.art002).length;
  const [renegotiatingId, setRenegotiatingId] = useState<string | null>(null);

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
            ) : rows.map((row) => {
              const hasCharge = row.lateCharge.fee > 0 || row.lateCharge.interest > 0;
              return (
                <div key={row.memberId} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-sand-light">{row.memberName}</p>
                      <p className="mt-1 text-xs text-sand-dark">
                        {row.openCount} mensalidade{row.openCount > 1 ? 's' : ''} em aberto • vencimento mais antigo em{' '}
                        {new Date(row.oldestDueDate).toLocaleDateString('pt-BR')} • situação atual: {memberStatusLabel(row.memberStatus)}
                      </p>
                      {hasCharge ? (
                        <p className="mt-1 text-xs text-amber-300/80">
                          Com multa/juros hoje: {brl(row.lateCharge.total)} (multa {brl(row.lateCharge.fee)} + juros {brl(row.lateCharge.interest)})
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-right text-xs text-sand-dark tabular-nums">{brl(row.totalAmount)}</span>
                      <Badge variant={row.art002 ? 'overdue' : 'warning'}>
                        {row.art002 ? `Art. 002 — ${row.daysOverdue} dias` : `${row.daysOverdue} dias em aberto`}
                      </Badge>
                      {canRenegotiate ? (
                        <Button
                          className="!px-3 !py-1 text-xs"
                          onClick={() => setRenegotiatingId(renegotiatingId === row.memberId ? null : row.memberId)}
                        >
                          Negociar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {renegotiatingId === row.memberId ? (
                    <RenegotiateForm memberId={row.memberId} onDone={() => { setRenegotiatingId(null); router.refresh(); }} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
