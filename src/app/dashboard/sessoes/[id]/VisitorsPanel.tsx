'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, EmptyState, inputClass, useConfirm } from '@/components/ui';
import { EMPTY_VISITOR, VisitorFieldsInputs, visitorFormFrom, type VisitorFormValue } from '@/components/visitor-fields';
import { visitorLodgeLabel } from '@/lib/visitors';

// Visitantes da sessão: a Secretaria digita a lista em papel preenchida na sessão. Ao digitar
// o nome (ou e-mail), sugere quem já visitou — escolher reaproveita o cadastro.

export interface SessionVisit {
  visitId: string;
  visitorId: string;
  name: string;
  degree: string | null;
  lodgeName: string | null;
  lodgeNumber: string | null;
  orient: string | null;
  powerName: string | null;
  email: string | null;
  phone: string | null;
  anonymized: boolean;
  certificateSentAt: string | null;
}

interface Suggestion {
  id: string; name: string; degree: string | null; lodgeName: string | null; lodgeNumber: string | null; orient: string | null;
  powerName: string | null; cim: string | null; phone: string | null; email: string | null; visits: number;
}

export function VisitorsPanel({ sessionId, visits }: { sessionId: string; visits: SessionVisit[] }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<VisitorFormValue>(EMPTY_VISITOR);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [consent, setConsent] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(q: string) {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/visitors?q=${encodeURIComponent(q.trim())}`).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => ({})) : {};
      setSuggestions(Array.isArray(data.items) ? data.items : []);
    }, 300);
  }

  function onNameChange(name: string) {
    setForm({ ...form, name });
    // Mexeu no nome depois de escolher um cadastro: vira um cadastro novo (a menos que escolha de novo).
    if (visitorId) setVisitorId(null);
    search(name);
  }

  function pick(s: Suggestion) {
    setForm(visitorFormFrom(s));
    setVisitorId(s.id);
    setSuggestions([]);
  }

  function reset() {
    setForm(EMPTY_VISITOR);
    setVisitorId(null);
    setConsent(true);
    setSuggestions([]);
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/sessions/${sessionId}/visitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, visitorId, consent }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMessage({ kind: 'error', text: data.error ?? 'Erro ao adicionar o visitante.' }); return; }
    setMessage({ kind: 'ok', text: `${form.name} adicionado à lista da sessão.` });
    reset();
    router.refresh();
  }

  async function remove(v: SessionVisit) {
    if (!(await askConfirm({ title: 'Tirar da lista', message: `Tirar ${v.name} da lista de visitantes desta sessão? O cadastro dele continua.`, confirmLabel: 'Tirar da lista', intent: 'danger' }))) return;
    const res = await fetch(`/api/sessions/${sessionId}/visitors/${v.visitId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? { kind: 'ok', text: `${v.name} saiu da lista.` } : { kind: 'error', text: data.error ?? 'Erro ao remover.' });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-sand-light">Visitantes da sessão</h2>
          <p className="mt-1 text-xs text-sand-dark">Digite aqui a lista de visitantes preenchida na sessão. É a base do certificado de presença enviado a cada um.</p>
        </div>
        {!open ? <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>Adicionar visitante</Button> : null}
      </div>

      {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

      {open ? (
        <form onSubmit={add} className="space-y-3 rounded-lg border border-white/8 bg-sigma-blue-deep/50 p-4">
          <VisitorFieldsInputs
            value={form}
            onChange={setForm}
            nameSlot={
              <span className="relative block">
                <input value={form.name} onChange={(e) => onNameChange(e.target.value)} className={inputClass} required autoComplete="off" placeholder="digite para buscar quem já visitou" />
                {suggestions.length > 0 ? (
                  <span className="absolute z-20 mt-1 block w-full rounded-lg border border-white/10 bg-sigma-card-elevated p-1 shadow-lg">
                    {suggestions.map((s) => (
                      <button key={s.id} type="button" onClick={() => pick(s)} className="block w-full rounded-md px-3 py-2 text-left text-sm text-sand transition hover:bg-white/5">
                        <span className="text-sand-light">{s.name}</span>
                        <span className="block text-xs text-sand-dark">{[visitorLodgeLabel(s), s.email, `${s.visits} visita(s)`].filter(Boolean).join(' · ')}</span>
                      </button>
                    ))}
                  </span>
                ) : null}
              </span>
            }
          />
          {visitorId ? <p className="text-xs text-emerald-300">Cadastro já existente — o que você alterar aqui atualiza o cadastro.</p> : null}
          <label className={`flex items-center gap-2 text-sm ${form.email ? 'text-sand' : 'text-sand-dark/60'}`}>
            <input type="checkbox" checked={consent && !!form.email} onChange={(e) => setConsent(e.target.checked)} disabled={!form.email} className="accent-gold" />
            Autorizou o envio do certificado para o e-mail (consentimento da lista de presença)
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>{saving ? 'Adicionando…' : 'Adicionar à lista'}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { reset(); setOpen(false); }} disabled={saving}>Fechar</Button>
          </div>
        </form>
      ) : null}

      {visits.length === 0 ? (
        <EmptyState title="Nenhum visitante nesta sessão." description="Use a lista em branco dos Impressos da sessão e digite aqui o que os irmãos visitantes preencheram." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left text-xs text-sand-dark">
                <th className="py-2 pr-3 font-medium">Irmão</th>
                <th className="py-2 pr-3 font-medium">Grau</th>
                <th className="py-2 pr-3 font-medium">Loja</th>
                <th className="py-2 pr-3 font-medium">Contato</th>
                <th className="py-2 pr-3 font-medium">Certificado</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.visitId} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5 pr-3 text-sand-light">{v.name}</td>
                  <td className="py-2.5 pr-3 text-sand">{v.degree ?? '—'}</td>
                  <td className="py-2.5 pr-3 text-xs text-sand-dark">{visitorLodgeLabel(v) || '—'}</td>
                  <td className="py-2.5 pr-3 text-xs text-sand-dark">{[v.email, v.phone].filter(Boolean).join(' · ') || (v.anonymized ? 'dados removidos' : '—')}</td>
                  <td className="py-2.5 pr-3 text-xs">
                    {v.certificateSentAt
                      ? <span className="text-emerald-300">enviado em {new Date(v.certificateSentAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                      : <span className="text-sand-dark">{v.email ? 'a emitir' : 'sem e-mail'}</span>}
                  </td>
                  <td className="py-2.5 text-right">
                    {!v.certificateSentAt ? <button type="button" onClick={() => void remove(v)} className="text-xs text-rose-300 transition hover:text-rose-200">Tirar da lista</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
