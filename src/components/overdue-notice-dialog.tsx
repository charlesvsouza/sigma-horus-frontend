'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { brl } from '@/lib/currency';
import { WhatsAppSendDialog, type WhatsAppShare } from '@/components/whatsapp-send-dialog';

// Aviso de inadimplência (Relatórios → Inadimplência — Art. 002): conferência do envio para todos os irmãos
// que estão na lista (respeita a busca e os filtros da tela). E-mail em massa para os marcados; quem não tem
// e-mail (ou se preferir) recebe pelo WhatsApp, um a um, com o texto pronto e quem aperta Enviar é o Tesoureiro.
// Nada sai antes de apertar o botão.

interface PreviewMember {
  memberId: string; name: string; email: string | null; hasPhone: boolean;
  count: number; total: number; daysOverdue: number; art002: boolean; sentRecently: boolean; lastSentAt: string | null;
}
interface Preview { emailReady: boolean; leftOut: number; sample: string | null; members: PreviewMember[] }
interface SendResult { sent: number; failed: number; skipped: number; failures: { name: string; detail: string }[] }

const eligible = (m: PreviewMember) => !!m.email && !m.sentRecently;
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

async function post(memberIds: string[], extra: Record<string, unknown>) {
  const res = await fetch('/api/reports/inadimplencia/aviso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberIds, ...extra }) });
  return { res, data: await res.json().catch(() => ({})) };
}

async function fetchWhatsAppShare(memberId: string): Promise<{ ok: true; share: WhatsAppShare } | { ok: false; error: string }> {
  const res = await fetch(`/api/members/${memberId}/overdue-notice`);
  const d = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: d.error ?? 'Erro ao preparar a mensagem.' };
  return {
    ok: true,
    share: {
      key: d.memberId,
      heading: 'Avisar inadimplência pelo WhatsApp',
      recipientName: d.memberName,
      phone: d.phone,
      rawPhone: d.rawPhone,
      details: `${d.count === 1 ? '1 cobrança vencida' : `${d.count} cobranças vencidas`} · ${brl(d.total)} · mais antiga há ${d.daysOverdue} dias${d.lastSentAt ? ` · último aviso em ${fmtDay(d.lastSentAt)}` : ''}`,
      text: d.text,
      itemNoun: 'o aviso',
      endpoint: `/api/members/${d.memberId}/overdue-notice`,
      footnote: 'O irmão responde na própria conversa. Quando pagar, a cobrança sai do relatório; o aviso fica registrado em Comunicação e não se repete antes de 7 dias.',
    },
  };
}

export function OverdueNoticeDialog({ memberIds, onClose }: { memberIds: string[]; onClose: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [share, setShare] = useState<WhatsAppShare | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  async function load(keepSelection = false) {
    const { res, data } = await post(memberIds, { action: 'preview' }).catch(() => ({ res: null, data: { error: 'Sem conexão com o servidor.' } }));
    setLoading(false);
    if (!res || !res.ok) { setError(data.error ?? 'Erro ao montar a lista de envio.'); setPreview(null); return; }
    setError('');
    setPreview(data as Preview);
    if (!keepSelection) setSelected(new Set((data as Preview).members.filter(eligible).map((m) => m.memberId)));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial do diálogo (cliente), como o diálogo de lembretes
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending && !share) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending, share]);

  const members = useMemo(() => preview?.members ?? [], [preview]);
  const picked = members.filter((m) => selected.has(m.memberId));
  const withoutEmail = members.filter((m) => !m.email);
  const recent = members.filter((m) => m.email && m.sentRecently);
  const allEligible = members.filter(eligible);

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function sendEmails() {
    setSending(true); setError('');
    try {
      const { res, data } = await post(memberIds, { action: 'send', sendIds: [...selected] });
      if (!res.ok) { setError(data.error ?? 'Erro ao enviar os avisos.'); return; }
      setResult(data as SendResult);
      await load();
      setSelected(new Set());
    } catch {
      setError('Sem conexão com o servidor. Confira em Comunicação o que chegou a sair antes de tentar de novo.');
    } finally {
      setSending(false);
    }
  }

  async function openWhatsApp(memberId: string) {
    setOpening(memberId); setError('');
    const r = await fetchWhatsAppShare(memberId);
    setOpening(null);
    if (!r.ok) { setError(r.error); return; }
    setShare(r.share);
  }

  return (
    <>
      <div role="dialog" aria-modal="true" aria-labelledby="overdue-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-sigma-blue-deep/70 px-4 py-6 backdrop-blur-sm" onClick={() => { if (!sending) onClose(); }}>
        <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-sigma-card-elevated" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 pt-6 pb-4">
            <div>
              <h2 id="overdue-dialog-title" className="text-base font-semibold text-sand-light">Avisar inadimplência</h2>
              <p className="mt-1 text-xs text-sand-dark">
                Um aviso por irmão da lista atual, dizendo que há mensalidades vencidas em aberto e que é preciso regularizar para não aumentar o custo do atraso nem chegar ao enquadramento no Art. 002. Por e-mail para todos de uma vez ou, se preferir, pelo WhatsApp, um a um.
              </p>
            </div>
            <button type="button" onClick={onClose} disabled={sending} aria-label="Fechar" className="text-sm text-sand-dark transition hover:text-sand-light disabled:opacity-40">✕</button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {preview && !preview.emailReady ? <Alert intent="danger">O envio de e-mail não está configurado na plataforma — use o WhatsApp.</Alert> : null}
            {preview && preview.leftOut > 0 ? <Alert intent="info">{preview.leftOut} irmão(s) da lista ficaram de fora: só recebem o aviso os irmãos com situação &quot;Ativo&quot; (bloqueados têm acordo; afastados e suspensos têm outro tratamento).</Alert> : null}
            {error ? <Alert intent="danger">{error}</Alert> : null}
            {result ? (
              <Alert intent={result.failed > 0 ? 'warn' : 'ok'}>
                {result.sent} e-mail(s) enviado(s){result.skipped > 0 ? ` · ${result.skipped} pulado(s) (sem e-mail ou já avisado nos últimos 7 dias)` : ''}{result.failed > 0 ? ` · ${result.failed} com falha: ${result.failures.map((f) => `${f.name} (${f.detail})`).join('; ')}` : ''}.
              </Alert>
            ) : null}

            {preview?.sample ? (
              <details className="rounded-lg border border-white/8 px-4 py-3">
                <summary className="cursor-pointer text-xs text-gold/80 hover:text-gold">Ver o texto do e-mail (exemplo com o 1º irmão da lista)</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-sand">{preview.sample}</pre>
              </details>
            ) : null}

            {loading ? (
              <p className="text-sm text-sand-dark">Montando a lista…</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-sand-dark">Ninguém na lista pode receber o aviso.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-sand-dark">
                  <span>
                    {members.length} irmão(s)
                    {withoutEmail.length > 0 ? ` · ${withoutEmail.length} sem e-mail` : ''}
                    {recent.length > 0 ? ` · ${recent.length} já avisado(s) nos últimos 7 dias` : ''}
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
                    const canEmail = eligible(m);
                    return (
                      <li key={m.memberId} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" aria-label={`Enviar e-mail para ${m.name}`} checked={selected.has(m.memberId)} onChange={() => toggle(m.memberId)} disabled={!canEmail || sending} className="mt-1 accent-gold" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <p className="text-sm font-medium text-sand-light">{m.name}{m.art002 ? <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-normal text-rose-300">Art. 002</span> : null}</p>
                              <p className="text-sm tabular-nums text-sand-light">{brl(m.total)}</p>
                            </div>
                            <p className="truncate text-xs text-sand-dark">
                              {m.count === 1 ? '1 cobrança' : `${m.count} cobranças`} · há {m.daysOverdue} dias ·{' '}
                              {m.email ?? <span className="text-amber-300">sem e-mail</span>}
                              {m.sentRecently && m.lastSentAt ? <span className="ml-2 text-sky-300">· avisado em {fmtDay(m.lastSentAt)}</span> : null}
                            </p>
                          </div>
                          <button type="button" onClick={() => void openWhatsApp(m.memberId)} disabled={opening === m.memberId || sending} title={m.hasPhone ? 'Abre o WhatsApp com o texto pronto' : 'Sem telefone válido: você escolhe o contato no WhatsApp'} className="shrink-0 rounded-full border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/60 disabled:opacity-40">
                            {opening === m.memberId ? 'Abrindo…' : 'WhatsApp'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 px-6 py-4">
            <span className="text-xs text-sand-dark">{picked.length} marcado(s) para e-mail · {brl(picked.reduce((s, m) => s + m.total, 0))} em aberto</span>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={onClose} disabled={sending}>Fechar</Button>
              <Button type="button" onClick={() => void sendEmails()} disabled={sending || picked.length === 0 || !preview?.emailReady}>
                {sending ? 'Enviando…' : `Enviar e-mail para ${picked.length}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {share ? <WhatsAppSendDialog share={share} onClose={() => setShare(null)} onChange={(_key, event) => { if (event === 'sent') void load(true); }} /> : null}
    </>
  );
}
