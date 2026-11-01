"use client";

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { BATCH_SKIP_LABEL, MAX_BATCH_PER_CALL, type BatchSkipReason } from '@/lib/asaas-batch-emit';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';

// Conferência da emissão em lote no Asaas (Cobranças → "Emitir em lote no Asaas"): mostra o que será
// emitido e o que fica de fora, e só emite depois da confirmação. Nada é cancelado nem recriado.

interface Item { invoiceId: string; number: string; memberName: string; dueDate: string; overdue: boolean; value: number | null; skip: BatchSkipReason | null }
interface Preview { billingType: string; items: Item[] }
interface Result { emitted: number; failed: number; skipped: number; failures: { number: string; name: string; detail: string }[] }

async function fetchPreview(): Promise<{ ok: true; preview: Preview } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/invoices/emit-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview' }) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, preview: data as Preview } : { ok: false, error: data.error ?? 'Erro ao montar a lista.' };
  } catch {
    return { ok: false, error: 'Sem conexão com o servidor.' };
  }
}

export function AsaasBatchEmitDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchPreview().then((r) => {
      if (!alive) return;
      setLoading(false);
      if (r.ok) setPreview(r.preview); else setError(r.error);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !running) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, running]);

  const items = useMemo(() => preview?.items ?? [], [preview]);
  const emittable = items.filter((i) => i.value !== null);
  const picked = emittable.filter((i) => includeOverdue || !i.overdue);
  const pickedTotal = picked.reduce((n, i) => n + (i.value ?? 0), 0);
  const overdueCount = emittable.filter((i) => i.overdue).length;
  const skippedGroups = useMemo(() => {
    const groups = new Map<BatchSkipReason, Item[]>();
    for (const i of items) if (i.skip) groups.set(i.skip, [...(groups.get(i.skip) ?? []), i]);
    return [...groups.entries()];
  }, [items]);

  async function run() {
    setRunning(true);
    setError('');
    const total: Result = { emitted: 0, failed: 0, skipped: 0, failures: [] };
    const ids = picked.map((i) => i.invoiceId);
    try {
      for (let start = 0; start < ids.length; start += MAX_BATCH_PER_CALL) {
        const res = await fetch('/api/invoices/emit-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send', invoiceIds: ids.slice(start, start + MAX_BATCH_PER_CALL) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(`${data.error ?? 'Erro ao emitir.'} ${total.emitted} cobrança(s) já foram emitidas antes do erro.`); break; }
        total.emitted += data.emitted ?? 0;
        total.failed += data.failed ?? 0;
        total.skipped += data.skipped ?? 0;
        total.failures.push(...(data.failures ?? []));
        setProgress(Math.min(start + MAX_BATCH_PER_CALL, ids.length));
      }
    } catch {
      setError(`Sem conexão com o servidor. ${total.emitted} cobrança(s) já foram emitidas; confira a lista de Cobranças antes de tentar de novo.`);
    }
    setResult(total);
    setRunning(false);
    onDone();
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="batch-emit-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-sigma-blue-deep/70 px-4 py-6 backdrop-blur-sm" onClick={() => { if (!running) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-sigma-card-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 pt-6 pb-4">
          <div>
            <h2 id="batch-emit-title" className="text-base font-semibold text-sand-light">Emitir em lote no Asaas</h2>
            <p className="mt-1 text-xs text-sand-dark">
              Emite no Asaas as cobranças em aberto que ainda não foram emitidas{preview ? ` (${preview.billingType === 'BOLETO' ? 'boleto' : 'Pix'})` : ''}. Nada é cancelado nem recriado: o número e o vencimento no sistema continuam os mesmos.
              Cobrança já vencida vai ao Asaas com vencimento de hoje.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={running} aria-label="Fechar" className="text-sm text-sand-dark transition hover:text-sand-light disabled:opacity-40">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {loading ? <p className="text-sm text-sand-dark">Montando a lista…</p> : null}
          {error ? <Alert intent="danger">{error}</Alert> : null}

          {result ? (
            <Alert intent={result.failed > 0 ? 'warn' : 'ok'}>
              {result.emitted} cobrança(s) emitida(s) no Asaas{result.failed > 0 ? `, ${result.failed} com falha` : ''}{result.skipped > 0 ? `, ${result.skipped} pulada(s) na conferência final` : ''}.
              {result.failures.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                  {result.failures.map((f) => <li key={f.number}>{f.number} — {f.name}: {f.detail}</li>)}
                </ul>
              ) : null}
            </Alert>
          ) : null}

          {preview && !result ? (
            <>
              <div className="rounded-lg border border-white/8 bg-sigma-blue-deep/40 px-4 py-3 text-sm text-sand">
                <strong className="tabular-nums text-sand-light">{picked.length}</strong> cobrança(s) a emitir · <strong className="tabular-nums text-gold">{brl(pickedTotal)}</strong>
                {overdueCount > 0 ? <> · <span className="text-rose-300">{overdueCount} vencida(s) entre elas</span></> : null}
              </div>

              {overdueCount > 0 ? (
                <label className="flex items-start gap-2 text-sm text-sand">
                  <input type="checkbox" checked={includeOverdue} onChange={(e) => setIncludeOverdue(e.target.checked)} disabled={running} className="mt-1 h-4 w-4" />
                  <span>Incluir as {overdueCount} vencida(s). Desmarque para emitir só as que ainda vão vencer.</span>
                </label>
              ) : null}

              {picked.length > 0 ? (
                <ul className="max-h-56 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/8 text-sm">
                  {picked.map((i) => (
                    <li key={i.invoiceId} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 truncate text-sand-light">{i.memberName} <span className="text-xs text-sand-dark">· {i.number}</span></span>
                      <span className="shrink-0 text-xs tabular-nums text-sand">{formatDateOnly(i.dueDate)}{i.overdue ? <span className="ml-1 text-rose-300">vencida</span> : null} · {brl(i.value ?? 0)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-sand-dark">Nenhuma cobrança a emitir.</p>}

              {skippedGroups.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-200">
                  <p className="font-medium">Ficam de fora ({items.filter((i) => i.skip).length}):</p>
                  {skippedGroups.map(([reason, list]) => (
                    <p key={reason}><strong>{BATCH_SKIP_LABEL[reason]}:</strong> {[...new Set(list.map((i) => i.memberName))].join(', ')}</p>
                  ))}
                </div>
              ) : null}

              {picked.length > 0 ? (
                <label className="flex items-start gap-2 text-sm text-sand">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={running} className="mt-1 h-4 w-4" />
                  <span>Conferi a lista: vou emitir {picked.length} cobrança(s) no Asaas.</span>
                </label>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/8 px-6 py-4">
          <span className="text-xs text-sand-dark">{running ? `Emitindo… ${progress} de ${picked.length}` : ''}</span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={running}>{result ? 'Fechar' : 'Cancelar'}</Button>
            {!result ? <Button type="button" onClick={() => void run()} disabled={running || !confirmed || picked.length === 0}>{running ? 'Emitindo…' : `Emitir ${picked.length} cobrança(s)`}</Button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
