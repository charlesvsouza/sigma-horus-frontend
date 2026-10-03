'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, inputClass, useConfirm, Toast } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import type { EndingMother } from '@/lib/recurring-renewal';

// Aviso em Cobranças: o período programado das recorrências está acabando (ou acabou há pouco).
// Tesoureiro/Administrador renovam aqui (mesmo valor, mais N repetições); o Venerável só vê o aviso.
export default function RecorrenciasTerminando({ items, canRenew }: { items: EndingMother[]; canRenew: boolean }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  const [repetitions, setRepetitions] = useState('12');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (items.length === 0) return null;
  const ended = items.filter((i) => i.ended).length;
  const last = items.reduce((max, i) => (i.lastDue > max ? i.lastDue : max), items[0].lastDue);
  const reps = Math.trunc(Number(repetitions));
  const valid = reps >= 1 && reps <= 36;

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function renew() {
    if (!(await askConfirm({
      title: 'Renovar recorrência',
      message: `${selected.size} recorrência(s) ganham mais ${reps} cobrança(s) com o mesmo valor. As que já terminaram recomeçam no próximo vencimento (os meses sem cobrança não são gerados de uma vez).`,
      confirmLabel: 'Renovar',
    }))) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/invoices/recurring-renew', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selected], repetitions: reps }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage({ kind: 'error', text: data.error ?? 'Não foi possível renovar.' }); return; }
    setMessage({ kind: 'ok', text: `${data.renewed} recorrência(s) renovada(s).` });
    router.refresh();
  }

  return (
    <section aria-labelledby="rec-end-title" className="mx-auto mt-6 max-w-6xl px-6">
      <Alert intent="warn">
        <h2 id="rec-end-title" className="text-sm font-semibold">Recorrências chegando ao fim ({items.length})</h2>
        <p className="mt-1 text-xs">
          {ended > 0 ? `${ended} já geraram a última cobrança. ` : ''}A última cobrança do período sai com vencimento em {formatDateOnly(last)}; depois disso o sistema
          deixa de gerar mensalidade para esses irmãos. Renove o período atual (mesmo valor) ou crie outro em <strong>Nova cobrança → Criar como cobrança recorrente</strong>.
        </p>
        {canRenew ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs">
              <span className="mb-1 block font-medium">Renovar por mais (repetições)</span>
              <input type="number" min={1} max={36} value={repetitions} onChange={(e) => setRepetitions(e.target.value)} className={`${inputClass} w-28`} />
            </label>
            <Button type="button" size="sm" disabled={busy || !valid || selected.size === 0} onClick={() => void renew()}>
              {busy ? 'Renovando…' : `Renovar ${selected.size} selecionada(s)`}
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-xs">A renovação é feita pelo Tesoureiro ou pelo Administrador.</p>
        )}
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-medium">Ver as {items.length} recorrências</summary>
          <ul className="mt-2 max-h-72 space-y-1 overflow-auto">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2">
                {canRenew ? <input type="checkbox" aria-label={`Renovar ${i.memberName ?? i.number}`} checked={selected.has(i.id)} onChange={() => toggle(i.id)} /> : null}
                <span>{i.memberName ?? i.number} · {brl(i.amount)} · {i.ended ? 'terminou' : 'termina'} em {formatDateOnly(i.lastDue)}</span>
              </li>
            ))}
          </ul>
          {canRenew ? (
            <p className="mt-2 flex gap-3">
              <button type="button" className="underline" onClick={() => setSelected(new Set(items.map((i) => i.id)))}>Marcar todas</button>
              <button type="button" className="underline" onClick={() => setSelected(new Set())}>Desmarcar todas</button>
            </p>
          ) : null}
        </details>
      </Alert>
      <Toast message={message} onClose={() => setMessage(null)} />
    </section>
  );
}
