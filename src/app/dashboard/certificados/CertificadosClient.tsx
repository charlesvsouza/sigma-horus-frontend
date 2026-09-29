'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, EmptyState, inputClass, useConfirm } from '@/components/ui';
import { CERTIFICATE_TEMPLATES, normalizeTemplate, type CertificateTemplate } from '@/lib/certificate';

export interface CertSession { id: string; title: string; date: string; typeLabel: string; ended: boolean; visitors: number; sent: number }
export interface CertVisit {
  id: string; name: string; degree: string | null; email: string | null; consent: boolean; anonymized: boolean;
  number: string | null; sentAt: string | null; status: string | null;
}

const TEMPLATE_KEY = 'sigma.certificado.modelo';
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });


/** Por que não dá para enviar por e-mail (null = pode). */
function blockReason(v: CertVisit, ended: boolean): string | null {
  if (v.anonymized) return 'dados removidos (LGPD)';
  if (!ended) return 'a sessão ainda não terminou';
  if (!v.email) return 'sem e-mail — baixe e entregue em mãos';
  if (!v.consent) return 'sem consentimento registrado';
  return null;
}

export default function CertificadosClient({ sessions, selectedId, visits }: { sessions: CertSession[]; selectedId: string | null; visits: CertVisit[] }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [template, setTemplate] = useState<CertificateTemplate>('classico');

  // Modelo preferido deste navegador (localStorage só existe no cliente; ler no render daria
  // diferença entre o HTML do servidor e o do navegador).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TEMPLATE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setTemplate(normalizeTemplate(saved));
    } catch { /* sem storage: fica o padrão */ }
  }, []);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const pending = selected ? visits.filter((v) => !v.sentAt && !blockReason(v, selected.ended)) : [];

  function chooseTemplate(t: CertificateTemplate) {
    setTemplate(t);
    try { window.localStorage.setItem(TEMPLATE_KEY, t); } catch { /* preferência só deste navegador */ }
  }

  async function send(v: CertVisit, resend: boolean): Promise<boolean> {
    const res = await fetch(`/api/certificates/${v.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelo: template, resend }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage({ kind: 'error', text: `${v.name}: ${data.error ?? 'erro ao enviar.'}` }); return false; }
    return true;
  }

  async function sendOne(v: CertVisit) {
    const resend = Boolean(v.sentAt);
    if (resend && !(await askConfirm({ title: 'Reenviar certificado', message: `O certificado de ${v.name} já foi enviado em ${fmtDate(v.sentAt!)}. Reenviar para ${v.email}? O número continua o mesmo.`, confirmLabel: 'Reenviar' }))) return;
    setBusy(v.id);
    setMessage(null);
    const ok = await send(v, resend);
    setBusy(null);
    if (ok) { setMessage({ kind: 'ok', text: `Certificado enviado para ${v.name} (${v.email}).` }); router.refresh(); }
  }

  async function sendAll() {
    if (!(await askConfirm({
      title: 'Enviar certificados',
      message: `Enviar o certificado (modelo ${CERTIFICATE_TEMPLATES.find((t) => t.id === template)?.label}) para ${pending.length} visitante(s): ${pending.map((p) => p.name).join(', ')}?`,
      confirmLabel: `Enviar ${pending.length}`,
    }))) return;
    setBusy('all');
    setMessage(null);
    let ok = 0;
    for (const v of pending) if (await send(v, false)) ok++;
    setBusy(null);
    if (ok > 0) setMessage((m) => (m?.kind === 'error' ? { kind: 'error', text: `${ok} enviado(s). ${m.text}` } : { kind: 'ok', text: `${ok} certificado(s) enviado(s).` }));
    router.refresh();
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Certificados de presença</h1>
          <p className="mt-1 max-w-3xl text-sm text-sand-dark">
            Para os irmãos visitantes de cada sessão, no modelo de diploma, com número e QR Code de verificação. Revise a prévia antes de enviar:
            o PDF enviado é exatamente o da prévia, com o número e o QR no lugar da marca d&apos;água.
          </p>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        {sessions.length === 0 ? (
          <EmptyState title="Nenhuma sessão com visitantes." description="Cadastre os visitantes na sessão (Sessões → abrir a sessão → Visitantes da sessão) e volte aqui depois dela." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
            <nav aria-label="Sessões com visitantes" className="space-y-2">
              {sessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/certificados?sessao=${s.id}`}
                  className={`block rounded-lg border px-4 py-3 text-sm transition ${s.id === selectedId ? 'border-gold/50 bg-gold/10' : 'border-white/6 bg-sigma-card hover:border-white/12'}`}
                >
                  <span className="block text-sand-light">{fmtDate(s.date)} — {s.typeLabel}</span>
                  <span className="block truncate text-xs text-sand-dark">{s.title}</span>
                  <span className="mt-1 block text-xs text-sand-dark">{s.visitors} visitante(s) · {s.sent} enviado(s)</span>
                </Link>
              ))}
            </nav>

            {selected ? (
              <section className="space-y-4 rounded-xl border border-white/6 bg-sigma-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-sand-light">Sessão {selected.typeLabel} de {fmtDate(selected.date)}</h2>
                    <p className="text-xs text-sand-dark">{selected.title}{!selected.ended ? ' · ainda não terminou' : ''}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-sand-dark">
                      Modelo{' '}
                      <select value={template} onChange={(e) => chooseTemplate(normalizeTemplate(e.target.value))} className={`${inputClass} ml-1 inline-block w-auto py-1.5 text-xs`}>
                        {CERTIFICATE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </label>
                    <Button type="button" size="sm" onClick={() => void sendAll()} disabled={busy !== null || pending.length === 0}>
                      {busy === 'all' ? 'Enviando…' : `Enviar pendentes (${pending.length})`}
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-white/8 text-left text-xs text-sand-dark">
                        <th className="py-2 pr-3 font-medium">Irmão</th>
                        <th className="py-2 pr-3 font-medium">E-mail</th>
                        <th className="py-2 pr-3 font-medium">Certificado</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {visits.map((v) => {
                        const reason = blockReason(v, selected.ended);
                        return (
                          <tr key={v.id} className="border-b border-white/5 last:border-0">
                            <td className="py-2.5 pr-3 text-sand-light">{v.name}{v.degree ? <span className="ml-2 text-xs text-sand-dark">{v.degree}</span> : null}</td>
                            <td className="py-2.5 pr-3 text-xs text-sand-dark">{v.email ?? '—'}</td>
                            <td className="py-2.5 pr-3 text-xs">
                              {v.sentAt ? <span className="text-emerald-300">{v.number} · enviado em {fmtDate(v.sentAt)}</span>
                                : v.status === 'failed' ? <span className="text-rose-300">falhou{v.number ? ` (${v.number})` : ''} — tente de novo</span>
                                : v.number ? <span className="text-sand">{v.number} · emitido, não enviado</span>
                                : <span className="text-sand-dark">{reason ?? 'pendente'}</span>}
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
                                {!v.anonymized ? <button type="button" onClick={() => setPreviewId(previewId === v.id ? null : v.id)} className="text-gold transition hover:text-gold-light">{previewId === v.id ? 'Fechar prévia' : 'Prévia'}</button> : null}
                                {!v.anonymized && selected.ended ? (
                                  <a href={`/api/certificates/${v.id}?modelo=${template}`} className="text-sand-dark transition hover:text-sand-light" title="Emite o número (se ainda não tem) e baixa o PDF">Baixar PDF</a>
                                ) : null}
                                {!reason ? (
                                  <button type="button" onClick={() => void sendOne(v)} disabled={busy !== null} className="rounded-full border border-gold/40 px-3 py-1 font-medium text-gold/80 transition hover:border-gold/60 hover:text-gold disabled:opacity-40">
                                    {busy === v.id ? 'Enviando…' : v.sentAt ? 'Reenviar' : 'Enviar por e-mail'}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {previewId ? (
                  <div className="rounded-lg border border-white/8 bg-sigma-blue-deep/50 p-2">
                    <iframe
                      key={`${previewId}-${template}`}
                      title="Prévia do certificado"
                      src={`/api/certificates/${previewId}?preview=1&modelo=${template}`}
                      className="h-[32rem] w-full rounded bg-white"
                    />
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
