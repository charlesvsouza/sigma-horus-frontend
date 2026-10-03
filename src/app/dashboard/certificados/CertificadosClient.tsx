'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, inputClass, useConfirm, Toast } from '@/components/ui';
import { CERTIFICATE_TEMPLATES, LODGE_TEMPLATE_LABEL, normalizeTemplate, type CertificateTemplate } from '@/lib/certificate';

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

export default function CertificadosClient({
  sessions, selectedId, visits, art, canManageArt,
}: {
  sessions: CertSession[];
  selectedId: string | null;
  visits: CertVisit[];
  /** Arte própria da loja: enviada e pronta (com as posições dos campos configuradas). */
  art: { uploaded: boolean; ready: boolean };
  canManageArt: boolean;
}) {
  const router = useRouter();
  const askConfirm = useConfirm();
  // Com a arte da loja pronta, ela é o modelo padrão.
  const defaultTemplate: CertificateTemplate = art.ready ? 'loja' : 'classico';
  const [template, setTemplate] = useState<CertificateTemplate>(defaultTemplate);
  const templates = [...(art.ready ? [{ id: 'loja' as const, label: LODGE_TEMPLATE_LABEL }] : []), ...CERTIFICATE_TEMPLATES];
  const lodgeArt = template === 'loja';

  // Modelo preferido deste navegador (localStorage só existe no cliente; ler no render daria
  // diferença entre o HTML do servidor e o do navegador). "loja" sem arte pronta não vale.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TEMPLATE_KEY);
      const t = saved ? normalizeTemplate(saved) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (t && (t !== 'loja' || art.ready)) setTemplate(t);
    } catch { /* sem storage: fica o padrão */ }
  }, [art.ready]);
  const [artBusy, setArtBusy] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const pending = selected ? visits.filter((v) => !v.sentAt && !blockReason(v, selected.ended)) : [];

  function chooseTemplate(t: CertificateTemplate) {
    setTemplate(t);
    try { window.localStorage.setItem(TEMPLATE_KEY, t); } catch { /* preferência só deste navegador */ }
  }

  async function uploadArt(file: File) {
    setArtBusy(true);
    setMessage(null);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/certificates/art', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    setArtBusy(false);
    if (!res.ok) { setMessage({ kind: 'error', text: data.error ?? 'Erro ao enviar a arte.' }); return; }
    setMessage({ kind: 'ok', text: 'Arte do certificado atualizada. Confira na prévia.' });
    router.refresh();
  }

  async function removeArt() {
    if (!(await askConfirm({ title: 'Remover arte', message: 'Remover a arte do certificado da loja? Os certificados voltam aos modelos do sistema até você enviar outra.', confirmLabel: 'Remover', intent: 'danger' }))) return;
    setArtBusy(true);
    const res = await fetch('/api/certificates/art', { method: 'DELETE' });
    setArtBusy(false);
    if (!res.ok) { setMessage({ kind: 'error', text: 'Erro ao remover a arte.' }); return; }
    if (template === 'loja') chooseTemplate('classico');
    router.refresh();
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
      message: `Enviar o certificado (modelo ${templates.find((t) => t.id === template)?.label}) para ${pending.length} visitante(s): ${pending.map((p) => p.name).join(', ')}?`,
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
            Para os irmãos visitantes de cada sessão, no modelo de diploma. Revise a prévia antes de enviar: o PDF enviado é exatamente o
            da prévia, sem a marca d&apos;água{lodgeArt ? '' : ' e com o número e o QR Code de verificação'}.
            {lodgeArt ? ' No modelo da loja saem só o nome do Irmão, a Loja dele e a data da sessão, nas linhas da arte — sem número nem QR.' : ''}
          </p>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        {canManageArt ? (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/6 bg-sigma-card px-5 py-4">
            <div className="max-w-2xl">
              <h2 className="text-sm font-semibold text-sand-light">Arte da loja</h2>
              <p className="mt-0.5 text-xs text-sand-dark">
                {art.ready
                  ? 'O certificado no modelo da loja usa esta arte. Para trocar (ex.: nova versão para o novo veneralato), envie o arquivo novo no mesmo desenho — as posições dos campos continuam valendo.'
                  : art.uploaded
                    ? 'Arte enviada. Falta configurar onde o sistema escreve cada campo — fale com o suporte do Sigma Horus.'
                    : 'Use o diploma que a loja já tem: envie a arte (A4 paisagem, JPG de cerca de 200 dpi, PNG ou PDF, até 4 MB) e o suporte configura onde o sistema escreve o nome, a Loja e a data.'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className={`cursor-pointer rounded-full border border-gold/40 px-3 py-1.5 font-medium text-gold/80 transition hover:border-gold/60 hover:text-gold ${artBusy ? 'pointer-events-none opacity-40' : ''}`}>
                {artBusy ? 'Enviando…' : art.uploaded ? 'Trocar arte' : 'Enviar arte'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadArt(f); }}
                />
              </label>
              {art.uploaded ? <button type="button" onClick={() => void removeArt()} disabled={artBusy} className="text-sand-dark transition hover:text-rose-300 disabled:opacity-40">Remover</button> : null}
            </div>
          </section>
        ) : null}

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
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
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
