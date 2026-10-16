'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, inputClass } from '@/components/ui';
import { Toast } from '@/components/ui/toast';
import { brl } from '@/lib/currency';
import { TRONCO_SOURCES, TRONCO_SOURCE_LABEL, type TroncoSource } from '@/lib/tronco-session';

export interface UnassignedItem { paymentId: string; amount: number; paidAt: string; bankName: string | null; method: string; note: string | null; source: TroncoSource | null; suggestedSessionId: string | null }

const OTHER = '__other';
const METHOD_LABEL: Record<string, string> = { cash: 'Dinheiro', pix: 'Pix', transfer: 'Transferência', donation: 'Doação', other: 'Outro' };
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

// Entradas do Tronco já lançadas no caixa que ainda não têm sessão. Tesoureiro, Venerável e Administrador ligam cada uma à
// sessão de origem (ou deixam sem sessão enquanto não descobrem). Não mexe em valor, data nem conta.
export default function TroncoSemSessao({ items, sessions }: { items: UnassignedItem[]; sessions: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pick, setPick] = useState<Record<string, string>>({});
  const [src, setSrc] = useState<Record<string, TroncoSource>>({});
  const [otherDate, setOtherDate] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function assign(it: UnassignedItem) {
    const chosen = pick[it.paymentId] ?? it.suggestedSessionId ?? '';
    const other = chosen === OTHER;
    if (!chosen) { setMessage({ kind: 'error', text: 'Escolha a sessão.' }); return; }
    if (other && !otherDate[it.paymentId]) { setMessage({ kind: 'error', text: 'Informe o dia em que a sessão ocorreu.' }); return; }
    setBusy(it.paymentId);
    setMessage(null);
    const res = await fetch('/api/tronco/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId: it.paymentId, sessionId: other ? null : chosen, sessionDate: other ? otherDate[it.paymentId] : null, source: src[it.paymentId] ?? it.source ?? 'mixed' }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setMessage({ kind: 'error', text: data.error ?? 'Não foi possível atribuir.' }); return; }
    setMessage({ kind: 'ok', text: `${brl(it.amount)} atribuído à sessão.` });
    router.refresh();
  }

  if (items.length === 0) return null;
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <section id="tronco-sem-sessao" aria-labelledby="tronco-sem-sessao-t" className="mx-auto max-w-6xl px-6 pt-6">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-6">
        <h2 id="tronco-sem-sessao-t" className="text-base font-semibold text-amber-200">Tronco sem sessão ({items.length}) — {brl(total)}</h2>
        <p className="mt-1 text-xs text-sand-dark">Entradas já lançadas no caixa que ainda não foram ligadas a uma sessão. Escolha a sessão de origem e atribua; se ainda não souber, deixe aqui. O valor, a data e a conta não mudam.</p>
        <ul className="mt-3 divide-y divide-white/5">
          {items.map((it) => (
            <li key={it.paymentId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-sand-light"><span className="tabular-nums">{brl(it.amount)}</span> <span className="text-xs text-sand-dark">em {fmtDate(it.paidAt)}</span></p>
                <p className="text-xs text-sand-dark">{METHOD_LABEL[it.method] ?? it.method}{it.bankName ? ` · ${it.bankName}` : ''}{it.note ? ` · ${it.note}` : ''}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label={`Sessão — ${brl(it.amount)}`} value={pick[it.paymentId] ?? it.suggestedSessionId ?? ''} onChange={(e) => setPick((p) => ({ ...p, [it.paymentId]: e.target.value }))} className={`${inputClass} w-auto`}>
                  <option value="">Selecione a sessão…</option>
                  {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  <option value={OTHER}>Sessão não cadastrada (informar o dia)…</option>
                </select>
                {(pick[it.paymentId] ?? it.suggestedSessionId) === OTHER ? <input type="date" aria-label={`Dia da sessão — ${brl(it.amount)}`} max={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })} value={otherDate[it.paymentId] ?? ''} onChange={(e) => setOtherDate((p) => ({ ...p, [it.paymentId]: e.target.value }))} className={`${inputClass} w-auto`} /> : null}
                <select aria-label={`Origem do dinheiro — ${brl(it.amount)}`} value={src[it.paymentId] ?? it.source ?? 'mixed'} onChange={(e) => setSrc((p) => ({ ...p, [it.paymentId]: e.target.value as TroncoSource }))} className={`${inputClass} w-auto`}>
                  {TRONCO_SOURCES.map((k) => <option key={k} value={k}>{TRONCO_SOURCE_LABEL[k]}</option>)}
                </select>
                <Button size="sm" disabled={busy === it.paymentId} onClick={() => void assign(it)}>{busy === it.paymentId ? '…' : 'Atribuir à sessão'}</Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <Toast message={message} onClose={() => setMessage(null)} />
    </section>
  );
}
