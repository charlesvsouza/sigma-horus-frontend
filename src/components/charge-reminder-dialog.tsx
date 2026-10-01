"use client";

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { REMINDER_SCOPES, type ReminderScope } from '@/lib/charge-reminder';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';

// Conferência do lembrete em lote por e-mail (Cobranças → "Enviar lembretes por e-mail"):
// mostra quem recebe, o quê, quem fica de fora (sem e-mail / já recebeu hoje) — e só envia
// para os irmãos marcados. Nada sai antes do Tesoureiro apertar "Enviar".

interface PreviewItem { number: string; title: string; dueDate: string; status: string; payAmount: number; payable: boolean }
interface PreviewMember { memberId: string; name: string; email: string | null; total: number; sentToday: boolean; items: PreviewItem[] }
interface Preview { emailReady: boolean; asaasMode: boolean; hasPayMethod: boolean; members: PreviewMember[] }
interface SendResult { sent: number; failed: number; skipped: number; failures: { name: string; detail: string }[] }

const eligible = (m: PreviewMember) => !!m.email && !m.sentToday;

async function fetchPreview(scope: ReminderScope): Promise<{ ok: true; preview: Preview } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/invoices/remind-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview', scope }) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, preview: data as Preview } : { ok: false, error: data.error ?? 'Erro ao montar a lista de envio.' };
  } catch {
    return { ok: false, error: 'Sem conexão com o servidor.' };
  }
}

export function ChargeReminderDialog({ onClose }: { onClose: () => void }) {
  const [scope, setScope] = useState<ReminderScope>('all');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchPreview(scope).then((r) => {
      if (!alive) return;
      setLoading(false);
      if (!r.ok) { setError(r.error); setPreview(null); return; }
      setError('');
      setPreview(r.preview);
      setSelected(new Set(r.preview.members.filter(eligible).map((m) => m.memberId)));
    });
    return () => { alive = false; };
  }, [scope]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  const members = useMemo(() => preview?.members ?? [], [preview]);
  const picked = members.filter((m) => selected.has(m.memberId));
  const pickedInvoices = picked.reduce((n, m) => n + m.items.length, 0);
  const pickedTotal = picked.reduce((n, m) => n + m.total, 0);
  const withoutEmail = members.filter((m) => !m.email);
  const sentToday = members.filter((m) => m.email && m.sentToday);
  const allEligible = members.filter(eligible);

  function changeScope(next: ReminderScope) {
    if (next === scope) return;
    setLoading(true);
    setResult(null);
    setScope(next);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function send() {
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/invoices/remind-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', scope, memberIds: [...selected] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'Erro ao enviar os lembretes.'); return; }
      setResult(data as SendResult);
      // Atualiza a marcação "já recebeu hoje" de quem acabou de receber.
      const r = await fetchPreview(scope);
      if (r.ok) { setPreview(r.preview); setSelected(new Set()); }
    } catch {
      setError('Sem conexão com o servidor. Confira em Comunicação o que chegou a sair antes de tentar de novo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="reminder-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-sigma-blue-deep/70 px-4 py-6 backdrop-blur-sm" onClick={() => { if (!sending) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-sigma-card-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 pt-6 pb-4">
          <div>
            <h2 id="reminder-dialog-title" className="text-base font-semibold text-sand-light">Lembretes por e-mail</h2>
            <p className="mt-1 text-xs text-sand-dark">
              Um e-mail por irmão, com todas as cobranças dele. Cada cobrança vai com o próprio {preview?.asaasMode ? 'link de pagamento (ou o portal, se ainda não foi emitida no Asaas)' : 'Pix copia e cola'} — ele pode pagar uma sem a outra.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={sending} aria-label="Fechar" className="text-sm text-sand-dark transition hover:text-sand-light disabled:opacity-40">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div role="radiogroup" aria-label="Quais cobranças entram" className="flex flex-wrap gap-2">
            {REMINDER_SCOPES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={scope === s.value}
                onClick={() => changeScope(s.value)}
                disabled={sending}
                className={`rounded-full border px-3 py-1 text-xs transition ${scope === s.value ? 'border-gold/60 bg-gold/15 text-gold' : 'border-white/10 text-sand-dark hover:text-sand-light'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {preview && !preview.emailReady ? <Alert intent="danger">O envio de e-mail não está configurado na plataforma — nada será enviado.</Alert> : null}
          {preview && !preview.hasPayMethod ? <Alert intent="warn">A loja não cadastrou chave Pix nem dados bancários: o e-mail sai sem forma de pagamento. Cadastre em Configurações da loja.</Alert> : null}
          {preview && !preview.asaasMode && preview.hasPayMethod && members.some((m) => m.items.some((i) => !i.payable)) ? (
            <Alert intent="info">Sem chave Pix cadastrada, as cobranças saem com os dados bancários da loja, sem código Pix.</Alert>
          ) : null}
          {error ? <Alert intent="danger">{error}</Alert> : null}
          {result ? (
            <Alert intent={result.failed > 0 ? 'warn' : 'ok'}>
              {result.sent} e-mail(s) enviado(s){result.skipped > 0 ? ` · ${result.skipped} pulado(s) (sem e-mail ou já recebeu hoje)` : ''}{result.failed > 0 ? ` · ${result.failed} com falha: ${result.failures.map((f) => `${f.name} (${f.detail})`).join('; ')}` : ''}.
            </Alert>
          ) : null}

          {loading ? (
            <p className="text-sm text-sand-dark">Montando a lista…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-sand-dark">Nenhuma cobrança em aberto neste filtro.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-sand-dark">
                <span>
                  {members.length} irmão(s) com cobrança em aberto
                  {withoutEmail.length > 0 ? ` · ${withoutEmail.length} sem e-mail` : ''}
                  {sentToday.length > 0 ? ` · ${sentToday.length} já recebeu hoje` : ''}
                </span>
                {allEligible.length > 0 ? (
                  <span className="flex gap-3">
                    <button type="button" onClick={() => setSelected(new Set(allEligible.map((m) => m.memberId)))} className="text-gold transition hover:text-gold-light">Marcar todos</button>
                    <button type="button" onClick={() => setSelected(new Set())} className="text-gold transition hover:text-gold-light">Desmarcar</button>
                  </span>
                ) : null}
              </div>
              <ul className="divide-y divide-white/5 rounded-lg border border-white/8">
                {members.map((m) => {
                  const canSend = eligible(m);
                  return (
                    <li key={m.memberId} className={`px-4 py-3 ${canSend ? '' : 'opacity-60'}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Enviar para ${m.name}`}
                          checked={selected.has(m.memberId)}
                          onChange={() => toggle(m.memberId)}
                          disabled={!canSend || sending}
                          className="mt-1 accent-gold"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className="text-sm font-medium text-sand-light">{m.name}</p>
                            <p className="text-sm tabular-nums text-sand-light">{brl(m.total)}</p>
                          </div>
                          <p className="truncate text-xs text-sand-dark">
                            {m.email ?? <span className="text-amber-300">sem e-mail — cadastre em Membros</span>}
                            {m.email && m.sentToday ? <span className="ml-2 text-sky-300">· já recebeu hoje</span> : null}
                          </p>
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-gold/80 hover:text-gold">{m.items.length === 1 ? '1 cobrança' : `${m.items.length} cobranças`}</summary>
                            <ul className="mt-1 space-y-0.5 text-xs text-sand-dark">
                              {m.items.map((i) => (
                                <li key={i.number} className="flex justify-between gap-3">
                                  <span className="truncate">{i.number}{i.title ? ` — ${i.title}` : ''} · {formatDateOnly(i.dueDate)}</span>
                                  <span className="tabular-nums">{brl(i.payAmount)}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 px-6 py-4">
          <p className="text-xs text-sand-dark">
            {picked.length > 0 ? `${picked.length} irmão(s) · ${pickedInvoices} cobrança(s) · ${brl(pickedTotal)}` : 'Nenhum irmão marcado.'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={sending}>{result ? 'Fechar' : 'Cancelar'}</Button>
            <Button type="button" onClick={() => void send()} disabled={sending || loading || picked.length === 0 || !preview?.emailReady}>
              {sending ? 'Enviando…' : `Enviar ${picked.length} e-mail${picked.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
