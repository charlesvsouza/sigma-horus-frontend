'use client';

import { useEffect, useState } from 'react';
import { brl } from '@/lib/currency';

interface Totals { confirmed: number; pending: number; bySource: { members: number; visitors: number; mixed: number } }

// Total do Tronco de Solidariedade desta sessão (sem doador). Todos os cargos de gestão veem; lançar no caixa é do
// Tesoureiro, do Venerável e do Administrador (em Hospitalaria → Fundos).
export default function SessionTroncoCard({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<Totals | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/sessions/${sessionId}/tronco`)
      .then(async (res) => { if (!res.ok) throw new Error('x'); return (await res.json().catch(() => ({}))) as Totals; })
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [sessionId]);

  if (failed) return null;
  return (
    <section aria-labelledby="tronco-sessao-card" className="rounded-xl border border-white/6 bg-sigma-card p-6">
      <h2 id="tronco-sessao-card" className="text-base font-semibold text-sand-light">Tronco de Solidariedade desta sessão</h2>
      {!data ? (
        <p className="mt-2 text-sm text-sand-dark">Carregando…</p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-gold">{brl(data.confirmed)}</p>
          <p className="mt-1 text-xs text-sand-dark">
            Obreiros {brl(data.bySource.members)} · Visitantes {brl(data.bySource.visitors)} · Sem divisão {brl(data.bySource.mixed)}
            {data.pending > 0 ? <> · <span className="text-amber-300">aguardando confirmação {brl(data.pending)}</span></> : null}
          </p>
          <p className="mt-2 text-xs text-sand-dark">Sem identificar doadores. O lançamento no caixa é do Tesoureiro, do Venerável e do Administrador.</p>
        </>
      )}
    </section>
  );
}
