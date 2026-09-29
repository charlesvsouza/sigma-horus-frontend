'use client';

import { useEffect, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { WhatsAppSendDialog, type WhatsAppShare } from '@/components/whatsapp-send-dialog';

// Convocação da sessão, em dois passos: "Revisar" mostra a mensagem exata (gerada do que está
// SALVO), quem recebe e quem fica de fora; só depois de marcar "Conferi…" o envio sai — e o
// servidor recusa se a sessão mudou entre a prévia e o clique. Alterou depois de enviar: aparece
// a comparação e a próxima mensagem sai como RETIFICAÇÃO. A fila de WhatsApp repete o mesmo texto.

interface Preview {
  kind: 'initial' | 'rectification' | 'resend';
  subject: string;
  text: string;
  sentAt: string | null;
  degreesLabel: string | null;
  recipients: { id: string; name: string; hasEmail: boolean; hasPhone: boolean }[];
  excluded: { id: string; name: string; reason: 'below' | 'no-degree' }[];
  warnings: string[];
}

interface WaRow { memberId: string; name: string; phone: string | null; rawPhone: string | null; lastSentAt: string | null; lastOpenedAt: string | null }

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function ConvocationPanel({
  sessionId, sentAt, changed, sentText, currentText, blockedReason, onSent,
}: {
  sessionId: string;
  sentAt: string | null;
  changed: boolean;
  sentText: string | null;
  currentText: string;
  /** Motivo para não deixar revisar agora (ex.: ordem do dia editada e não salva). */
  blockedReason: string | null;
  onSent: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showWhatsApp, setShowWhatsApp] = useState(false);

  const label = !sentAt ? 'Revisar e enviar convocação' : changed ? 'Revisar e enviar retificação' : 'Revisar e reenviar';

  async function openPreview() {
    setLoading(true);
    setError('');
    const res = await fetch(`/api/sessions/${sessionId}/convocation`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) setPreview(data as Preview);
    else setError(data.error ?? 'Erro ao montar a prévia.');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-sand-light">Convocação (chamado)</h2>
          <p className="mt-1 text-xs text-sand-dark">
            {sentAt ? `Última convocação enviada em ${fmt(sentAt)}.` : 'Ainda não enviada.'} Vai por e-mail aos irmãos convocados pelos graus da sessão; depois, pelo WhatsApp, irmão por irmão.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button type="button" onClick={() => void openPreview()} disabled={loading || !!blockedReason}>{loading ? 'Montando prévia…' : label}</Button>
          {blockedReason ? <span className="max-w-xs text-right text-xs text-amber-300">{blockedReason}</span> : null}
        </div>
      </div>

      {error ? <Alert intent="danger">{error}</Alert> : null}

      {sentAt && changed ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-200">⚠ A sessão foi alterada depois da convocação.</p>
          <p className="mt-1 text-xs text-sand-dark">Os irmãos receberam a versão da esquerda. Envie a retificação para avisá-los da versão atual.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-sand-dark/70">Enviada</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-white/8 bg-sigma-blue-deep/60 p-3 text-xs text-sand">{sentText}</pre>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-sand-dark/70">Como está agora</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-gold/30 bg-sigma-blue-deep/60 p-3 text-xs text-sand-light">{currentText}</pre>
            </div>
          </div>
        </div>
      ) : null}

      {sentAt && !changed ? (
        <div>
          <button type="button" onClick={() => setShowWhatsApp((v) => !v)} className="text-sm text-emerald-300 transition hover:text-emerald-200">
            {showWhatsApp ? 'Fechar envio pelo WhatsApp' : 'Enviar também pelo WhatsApp (irmão por irmão)'}
          </button>
          {showWhatsApp ? <WhatsAppConvocationList sessionId={sessionId} /> : null}
        </div>
      ) : null}

      {preview ? (
        <ReviewDialog
          sessionId={sessionId}
          preview={preview}
          onClose={() => setPreview(null)}
          onReload={() => void openPreview()}
          onSent={() => { setPreview(null); onSent(); }}
        />
      ) : null}
    </div>
  );
}

function ReviewDialog({ sessionId, preview, onClose, onReload, onSent }: { sessionId: string; preview: Preview; onClose: () => void; onReload: () => void; onSent: () => void }) {
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ text: string; stale: boolean } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // Depois do envio, fechar por qualquer caminho atualiza a página (status e fila de WhatsApp).
  const close = result ? onSent : onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, sending]);

  const withoutEmail = preview.recipients.filter((r) => !r.hasEmail);
  const title = preview.kind === 'rectification' ? 'Revisar retificação' : preview.kind === 'resend' ? 'Revisar reenvio' : 'Revisar convocação';

  async function send() {
    setSending(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/convocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedText: preview.text }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError({ text: data.error ?? 'Erro ao enviar a convocação.', stale: res.status === 409 });
      return;
    }
    const s = data.stats ?? {};
    setResult(`${preview.kind === 'rectification' ? 'Retificação enviada' : 'Convocação enviada'}: ${s.sent ?? 0} e-mail(s) enviado(s)${s.queued ? `, ${s.queued} na fila` : ''}${s.failed ? `, ${s.failed} falharam` : ''}${s.skipped ? `, ${s.skipped} sem e-mail` : ''}.`);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="conv-review-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-sigma-blue-deep/70 px-4 py-6 backdrop-blur-sm" onClick={() => { if (!sending) close(); }}>
      <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-sigma-card-elevated p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="conv-review-title" className="text-base font-semibold text-sand-light">{title}</h2>
            <p className="mt-1 text-xs text-sand-dark">Assunto: <span className="text-sand">{preview.subject}</span></p>
          </div>
          <button type="button" onClick={close} disabled={sending} aria-label="Fechar" className="text-sm text-sand-dark transition hover:text-sand-light">✕</button>
        </div>

        {result ? (
          <>
            <Alert intent="ok" className="mt-4">{result}</Alert>
            <p className="mt-3 text-xs text-sand-dark">Para quem não lê e-mail, use &quot;Enviar também pelo WhatsApp&quot; no cartão da convocação.</p>
            <div className="mt-5 flex justify-end"><Button type="button" onClick={onSent}>Concluir</Button></div>
          </>
        ) : (
          <>
            {preview.warnings.map((w) => <Alert key={w} intent="warn" className="mt-4">{w}</Alert>)}

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_16rem]">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-sand-dark/70">Mensagem, exatamente como os irmãos vão receber</p>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-white/8 bg-sigma-blue-deep/60 p-3 text-xs leading-relaxed text-sand-light">{preview.text}</pre>
                <p className="mt-1 text-xs text-sand-dark">Algo errado? Feche, corrija os dados ou a ordem do dia, salve e revise de novo.</p>
              </div>
              <div className="space-y-3 text-xs">
                <div className="rounded-lg border border-white/8 bg-sigma-blue-deep/60 p-3">
                  <p className="text-sand-dark">Graus trabalhados</p>
                  <p className="mt-0.5 text-sm text-sand-light">{preview.degreesLabel ?? 'Nenhum marcado'}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-sigma-blue-deep/60 p-3">
                  <p className="text-sand-dark">Convocados</p>
                  <p className="mt-0.5 text-sm text-sand-light"><strong className="tabular-nums">{preview.recipients.length}</strong> irmão(s)</p>
                  {withoutEmail.length > 0 ? (
                    <details className="mt-1 text-amber-300">
                      <summary className="cursor-pointer">{withoutEmail.length} sem e-mail (use o WhatsApp)</summary>
                      <p className="mt-1 text-sand-dark">{withoutEmail.map((r) => r.name).join(', ')}</p>
                    </details>
                  ) : null}
                </div>
                {preview.excluded.length > 0 ? (
                  <div className="rounded-lg border border-white/8 bg-sigma-blue-deep/60 p-3">
                    <details>
                      <summary className="cursor-pointer text-sand-dark">{preview.excluded.length} não convocado(s) pelo grau</summary>
                      <ul className="mt-1 space-y-0.5">
                        {preview.excluded.map((e) => (
                          <li key={e.id} className={e.reason === 'no-degree' ? 'text-amber-300' : 'text-sand-dark'}>
                            {e.name}{e.reason === 'no-degree' ? ' — sem data de iniciação no cadastro' : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                ) : null}
              </div>
            </div>

            {error ? (
              <Alert intent="danger" className="mt-4">
                {error.text}
                {error.stale ? <button type="button" onClick={onReload} className="ml-2 underline">Revisar de novo</button> : null}
              </Alert>
            ) : null}

            <label className="mt-5 flex items-start gap-3 rounded-lg border border-white/8 bg-sigma-blue-deep/60 px-4 py-3">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 accent-gold" />
              <span className="text-sm text-sand">Conferi o título, a data e o horário, os graus e a ordem do dia. Depois de enviada, qualquer correção vai como retificação.</span>
            </label>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={sending} className="mr-auto">Fechar</Button>
              <Button type="button" onClick={() => void send()} disabled={!checked || sending || preview.recipients.length === 0}>
                {sending ? 'Enviando…' : `Enviar a ${preview.recipients.length} irmão(s)`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WhatsAppConvocationList({ sessionId }: { sessionId: string }) {
  const endpoint = `/api/sessions/${sessionId}/convocation/whatsapp`;
  const [data, setData] = useState<{ title: string; text: string; rows: WaRow[] } | null>(null);
  const [error, setError] = useState('');
  const [hideSent, setHideSent] = useState(true);
  const [share, setShare] = useState<WhatsAppShare | null>(null);

  async function load() {
    const res = await fetch(endpoint);
    const json = await res.json().catch(() => ({}));
    if (res.ok) { setData(json); setError(''); } else setError(json.error ?? 'Erro ao carregar a lista.');
  }

  // Carrega ao abrir a lista (o componente só existe quando o usuário pede).
  useEffect(() => {
    let active = true;
    fetch(endpoint)
      .then(async (res) => ({ ok: res.ok, json: await res.json().catch(() => ({})) }))
      .then(({ ok, json }) => { if (!active) return; if (ok) setData(json); else setError(json.error ?? 'Erro ao carregar a lista.'); });
    return () => { active = false; };
  }, [endpoint]);

  function openFor(row: WaRow) {
    if (!data) return;
    setShare({
      key: row.memberId,
      heading: 'Enviar convocação pelo WhatsApp',
      recipientName: row.name,
      phone: row.phone,
      rawPhone: row.rawPhone,
      details: data.title,
      text: data.text,
      itemNoun: 'a convocação',
      endpoint,
      extraBody: { memberId: row.memberId },
    });
  }

  if (error) return <Alert intent="danger" className="mt-3">{error}</Alert>;
  if (!data) return <p className="mt-3 text-xs text-sand-dark">Carregando…</p>;

  const sentCount = data.rows.filter((r) => r.lastSentAt).length;
  const rows = hideSent ? data.rows.filter((r) => !r.lastSentAt) : data.rows;

  return (
    <div className="mt-3 rounded-lg border border-white/8 bg-sigma-blue-deep/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-sand-dark">Mesmo texto do e-mail. <span className="tabular-nums text-sand">{sentCount}/{data.rows.length}</span> confirmados.</p>
        <label className="flex items-center gap-2 text-xs text-sand">
          <input type="checkbox" checked={hideSent} onChange={(e) => setHideSent(e.target.checked)} className="accent-gold" />
          Ocultar os já enviados
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-sand-dark">Todos os convocados já receberam pelo WhatsApp.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/5">
          {rows.map((r) => (
            <li key={r.memberId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="text-sm text-sand-light">
                {r.name}
                {!r.phone ? <span className="ml-2 text-xs text-amber-300">sem celular</span> : null}
                {r.lastSentAt ? <span className="ml-2 text-xs text-emerald-300">enviada {fmt(r.lastSentAt)}</span> : null}
                {r.lastOpenedAt ? <span className="ml-2 text-xs text-amber-300">aberta {fmt(r.lastOpenedAt)}, não confirmada</span> : null}
              </div>
              <button type="button" onClick={() => openFor(r)} className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:border-emerald-300/70 hover:text-emerald-200">
                {r.lastSentAt ? 'Reenviar' : 'Enviar'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {share ? <WhatsAppSendDialog key={share.key} share={share} onClose={() => setShare(null)} onChange={() => void load()} /> : null}
    </div>
  );
}
