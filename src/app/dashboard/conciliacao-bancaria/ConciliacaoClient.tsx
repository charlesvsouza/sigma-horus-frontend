'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, Alert } from '@/components/ui';

interface MatchedPayment { id: string; amount: number; paidAt: string; accountTitle: string | null; }
interface BankTx { id: string; date: string; description: string; amount: number; status: string; matchedPayment: MatchedPayment | null; }
interface Candidate { id: string; amount: number; paidAt: string; account: { title: string } | null; member: { name: string } | null; }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR');

function MatchPicker({ bankTxId, onDone }: { bankTxId: string; onDone: () => void }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/bank-reconciliation/${bankTxId}/candidates`);
    const data = await res.json();
    setCandidates(data.items ?? []);
    setLoading(false);
  }

  async function pick(paymentId: string) {
    await fetch(`/api/bank-reconciliation/${bankTxId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    });
    onDone();
  }

  if (candidates === null) {
    return (
      <button onClick={load} disabled={loading} className="text-xs text-gold/80 hover:text-gold">
        {loading ? 'Buscando…' : 'Vincular manualmente'}
      </button>
    );
  }

  if (candidates.length === 0) {
    return <p className="text-xs text-sand-dark">Nenhum pagamento próximo encontrado (±15 dias, mesma direção).</p>;
  }

  return (
    <div className="mt-2 space-y-1.5">
      {candidates.map((c) => (
        <button
          key={c.id}
          onClick={() => void pick(c.id)}
          className="block w-full rounded-lg border border-white/[6%] bg-sigma-blue-deep/50 px-3 py-2 text-left text-xs text-sand hover:border-gold/40"
        >
          {brl(c.amount)} • {fmt(c.paidAt)} • {c.account?.title ?? '—'} {c.member ? `• ${c.member.name}` : ''}
        </button>
      ))}
    </div>
  );
}

export default function ConciliacaoClient({ items }: { items: BankTx[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [pickingId, setPickingId] = useState<string | null>(null);

  async function handleFile(file: File) {
    setImporting(true);
    setMessage('');
    const content = await file.text();
    const res = await fetch('/api/bank-reconciliation/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    setImporting(false);
    if (res.ok) {
      setMessage(`Extrato importado: ${data.parsed} linha(s) lida(s), ${data.imported} nova(s), ${data.duplicates} já existiam, ${data.autoMatched} conciliada(s) automaticamente.`);
      router.refresh();
    } else {
      setMessage(data.error ?? 'Erro ao importar o extrato.');
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function ignore(id: string) {
    await fetch(`/api/bank-reconciliation/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ignored' }),
    });
    router.refresh();
  }

  async function undo(id: string) {
    await fetch(`/api/bank-reconciliation/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    router.refresh();
  }

  const unmatchedCount = items.filter((i) => i.status === 'unmatched').length;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Conciliação bancária</h1>
          <p className="mt-1 text-sm text-sand-dark">Importe o extrato do banco (OFX ou CSV) e concilie com os pagamentos já lançados no sistema.</p>
        </div>

        {message ? <Alert intent="warn">{message}</Alert> : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Importar extrato</h2>
          <p className="mt-1 text-sm text-sand-dark">Arquivo OFX (exportado pelo internet banking) ou CSV com colunas Data/Descrição/Valor.</p>
          <div className="mt-4">
            <input
              ref={fileRef}
              type="file"
              accept=".ofx,.csv,text/plain"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              disabled={importing}
              className="text-sm text-sand-dark file:mr-4 file:rounded-full file:border-0 file:bg-gold file:px-4 file:py-2 file:text-sm file:font-medium file:text-sigma-blue-deep hover:file:bg-gold-light"
            />
            {importing ? <p className="mt-2 text-xs text-sand-dark">Importando…</p> : null}
          </div>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-sand-light">Lançamentos importados</h2>
            {unmatchedCount > 0 ? <span className="text-xs text-amber-300">{unmatchedCount} sem conciliar</span> : null}
          </div>
          <div className="mt-5 space-y-3">
            {items.length === 0 ? (
              <EmptyState title="Nenhum extrato importado" description="Importe um arquivo OFX ou CSV para começar a conciliar." />
            ) : items.map((tx) => (
              <div key={tx.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-sand-light">{tx.description}</p>
                    <p className="mt-1 text-xs text-sand-dark">{fmt(tx.date)} • {tx.amount >= 0 ? 'Crédito' : 'Débito'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`tabular-nums text-sm font-semibold ${tx.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{brl(tx.amount)}</span>
                    {tx.status === 'matched' ? (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300">Conciliado</span>
                    ) : tx.status === 'ignored' ? (
                      <span className="rounded-full border border-white/10 bg-white/[6%] px-2.5 py-0.5 text-xs text-sand-dark">Ignorado</span>
                    ) : (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300">Sem conciliar</span>
                    )}
                  </div>
                </div>

                {tx.status === 'matched' && tx.matchedPayment ? (
                  <p className="mt-2 text-xs text-sand-dark">
                    Vinculado a: {tx.matchedPayment.accountTitle ?? '—'} — {brl(tx.matchedPayment.amount)} em {fmt(tx.matchedPayment.paidAt)}{' '}
                    <button onClick={() => void undo(tx.id)} className="ml-2 text-rose-300/70 hover:text-rose-300">Desfazer</button>
                  </p>
                ) : tx.status === 'ignored' ? (
                  <button onClick={() => void undo(tx.id)} className="mt-2 text-xs text-sand-dark hover:text-sand-light">Reabrir</button>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {pickingId === tx.id ? null : (
                      <button onClick={() => setPickingId(tx.id)} className="text-xs text-gold/80 hover:text-gold">Vincular manualmente</button>
                    )}
                    <button onClick={() => void ignore(tx.id)} className="text-xs text-sand-dark hover:text-sand-light">Ignorar</button>
                  </div>
                )}
                {pickingId === tx.id ? <MatchPicker bankTxId={tx.id} onDone={() => { setPickingId(null); router.refresh(); }} /> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
