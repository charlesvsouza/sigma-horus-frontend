'use client';

import { useCallback, useEffect, useState } from 'react';
import { inputClass } from '@/components/ui/field-styles';
import { RESTRICTION_KINDS, restrictionBadge, restrictionKind, restrictionLabel, SCOPE_LABEL, type RestrictionScope } from '@/lib/member-restriction';
import { formatDateOnly } from '@/lib/date-only';

interface Restriction {
  id: string;
  kind: string;
  scope: RestrictionScope;
  status: 'active' | 'ended';
  startedAt: string;
  deliberatedAt: string | null;
  expectedEndAt: string | null;
  reason: string | null;
  destination: string | null;
  protocol: string | null;
  endedAt: string | null;
  endNote: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = { kind: '', startedAt: today(), deliberatedAt: '', expectedEndAt: '', reason: '', destination: '', protocol: '' };

/** Restrições do cadastro com motivo (Regulamento Geral / Código Disciplinar): histórico, novo registro e encerramento. */
export default function RestrictionsPanel({ memberId, onChanged }: { memberId: string; onChanged: () => void }) {
  const [items, setItems] = useState<Restriction[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [endNote, setEndNote] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/members/${memberId}/restrictions`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? 'Não foi possível carregar as restrições.'); return; }
    setItems(data.items ?? []);
  }, [memberId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial do painel (cliente), como as demais telas de Membros
  useEffect(() => { void load(); }, [load]);

  const def = restrictionKind(form.kind);
  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch(`/api/members/${memberId}/restrictions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Não foi possível registrar.'); return; }
    setAdding(false); setForm({ ...emptyForm, startedAt: today() });
    await load(); onChanged();
  }

  async function end(id: string) {
    setBusy(true); setError('');
    const res = await fetch(`/api/member-restrictions/${id}/end`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: endNote }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Não foi possível encerrar.'); return; }
    setEndingId(null); setEndNote('');
    await load(); onChanged();
  }

  const active = (items ?? []).filter((r) => r.status === 'active');
  const ended = (items ?? []).filter((r) => r.status === 'ended');

  return (
    <div className="space-y-3 rounded-lg border border-white/8 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">Restrições do cadastro</p>
        {!adding ? <button type="button" onClick={() => setAdding(true)} className="rounded-full border border-gold/40 px-3 py-1.5 text-xs font-medium text-gold/80 transition-all hover:border-gold/60 hover:text-gold">Registrar restrição</button> : null}
      </div>

      {error ? <p role="alert" className="text-xs text-rose-300">{error}</p> : null}
      {items === null && !error ? <p className="text-xs text-sand-dark">Carregando…</p> : null}
      {items && active.length === 0 && !adding ? <p className="text-xs text-sand-dark">Nenhuma restrição em vigor.</p> : null}

      {active.map((r) => (
        <div key={r.id} className="rounded-md bg-amber-500/10 p-3 text-xs text-sand">
          <p className="font-medium text-amber-200">{restrictionBadge(r)}</p>
          <p className="mt-0.5 text-sand-dark">{restrictionKind(r.kind)?.article} · {SCOPE_LABEL[r.scope]}</p>
          <p className="mt-1">Desde {formatDateOnly(r.startedAt)}{r.deliberatedAt ? ` · deliberado em ${formatDateOnly(r.deliberatedAt)}` : ''}{r.protocol ? ` · registro ${r.protocol}` : ''}{r.destination ? ` · destino: ${r.destination}` : ''}</p>
          {r.reason ? <p className="mt-1">Motivo: {r.reason}</p> : null}
          {endingId === r.id ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input value={endNote} onChange={(e) => setEndNote(e.target.value)} maxLength={500} placeholder="Como terminou (reabilitação, cumprimento, retorno…)" aria-label="Como a restrição terminou" className={`${inputClass} max-w-sm`} />
              <button type="button" disabled={busy} onClick={() => void end(r.id)} className="rounded-full border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-300 disabled:opacity-40">Confirmar encerramento</button>
              <button type="button" onClick={() => { setEndingId(null); setEndNote(''); }} className="text-xs text-sand-dark">Cancelar</button>
            </div>
          ) : (
            <button type="button" onClick={() => setEndingId(r.id)} className="mt-2 rounded-full border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-all hover:border-emerald-500/60">Encerrar restrição</button>
          )}
        </div>
      ))}

      {adding ? (
        <form onSubmit={submit} className="space-y-3 rounded-md border border-white/8 p-3">
          <label className="block text-xs text-sand-dark">Motivo (base normativa)
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)} required className={`${inputClass} mt-1`}>
              <option value="">Escolha o motivo…</option>
              {RESTRICTION_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label} — {k.article}</option>)}
            </select>
          </label>
          {def ? (
            <p className="rounded-md bg-sigma-blue-deep/40 p-2 text-xs text-sand">{def.summary} <span className="text-sand-dark">({SCOPE_LABEL[def.scope]})</span></p>
          ) : null}
          {def ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-xs text-sand-dark">Início
                <input type="date" value={form.startedAt} onChange={(e) => set('startedAt', e.target.value)} required className={`${inputClass} mt-1`} />
              </label>
              {def.requiresDeliberation ? (
                <label className="block text-xs text-sand-dark">Deliberação da Loja (data)
                  <input type="date" value={form.deliberatedAt} onChange={(e) => set('deliberatedAt', e.target.value)} required className={`${inputClass} mt-1`} />
                </label>
              ) : null}
              {def.requiresEnd ? (
                <label className="block text-xs text-sand-dark">Fim previsto{def.maxMonths ? ` (até ${def.maxMonths} meses)` : ''}
                  <input type="date" value={form.expectedEndAt} onChange={(e) => set('expectedEndAt', e.target.value)} required className={`${inputClass} mt-1`} />
                </label>
              ) : null}
              {def.asksDestination ? (
                <label className="block text-xs text-sand-dark">Loja ou Potência de destino (se houver)
                  <input value={form.destination} onChange={(e) => set('destination', e.target.value)} maxLength={200} className={`${inputClass} mt-1`} />
                </label>
              ) : null}
              {def.asksProtocol ? (
                <label className="block text-xs text-sand-dark">Nº de registro na Grande Loja (se houver)
                  <input value={form.protocol} onChange={(e) => set('protocol', e.target.value)} maxLength={80} className={`${inputClass} mt-1`} />
                </label>
              ) : null}
            </div>
          ) : null}
          {def ? (
            <label className="block text-xs text-sand-dark">Motivo escrito{def.requiresReason ? '' : ' (opcional)'} — o irmão verá este texto
              <textarea value={form.reason} onChange={(e) => set('reason', e.target.value)} required={def.requiresReason} maxLength={2000} rows={3} className={`${inputClass} mt-1`} />
            </label>
          ) : null}
          {def?.requiresDebtClear ? <p className="text-xs text-sand-dark">As pendências do irmão precisam estar pagas no ato do pedido ou ajustadas em acordo (Tesouraria → Acordos).</p> : null}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy || !def} className="rounded-full border border-gold/40 px-4 py-2 text-xs font-medium text-gold transition-all hover:border-gold/60 disabled:opacity-40">{busy ? 'Registrando…' : 'Registrar'}</button>
            <button type="button" onClick={() => { setAdding(false); setError(''); }} className="text-xs text-sand-dark">Cancelar</button>
          </div>
        </form>
      ) : null}

      {ended.length > 0 ? (
        <details className="text-xs text-sand-dark">
          <summary className="cursor-pointer">Histórico ({ended.length})</summary>
          <ul className="mt-2 space-y-1">
            {ended.map((r) => (
              <li key={r.id}>{restrictionLabel(r.kind)}: {formatDateOnly(r.startedAt)} a {formatDateOnly(r.endedAt)}{r.endNote ? ` — ${r.endNote}` : ''}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
