'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';

// Comprovante recebido fora do portal (ex.: WhatsApp): a Tesouraria registra em nome do irmão.
// Mesma conferência automática do "Já paguei" (PDF); foto entra sem conferência automática.
// O aviso vai para o quadro de Pagamentos, aguardando a baixa — nada é baixado aqui.

export interface ReceiptContext {
  invoiceId: string;
  number: string;
  title: string;
  memberName: string;
  memberHasEmail: boolean;
  balance: number;
  dueDate: string;
  existing: { at: string; byStaff: string | null; hasReceipt: boolean } | null;
}

interface ReceiptCheck { status: 'conferido' | 'divergente' | 'ilegivel'; txid: boolean; amount: boolean; payee: boolean; e2e: string | null; paidAt: string | null; amountPaid?: number | null }

export async function fetchReceiptContext(invoiceId: string): Promise<{ ok: true; ctx: ReceiptContext } | { ok: false; error: string }> {
  const res = await fetch(`/api/invoices/${invoiceId}/receipt`);
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, ctx: data as ReceiptContext } : { ok: false, error: data.error ?? 'Erro ao abrir a cobrança.' };
}

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export function RegisterReceiptDialog({ ctx, onClose, onDone }: { ctx: ReceiptContext; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [paidAt, setPaidAt] = useState('');
  const [note, setNote] = useState('');
  const [notifyMember, setNotifyMember] = useState(ctx.memberHasEmail);
  const [replace, setReplace] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [needsDate, setNeedsDate] = useState(false);
  const [result, setResult] = useState<{ check: ReceiptCheck | null; image: boolean } | null>(null);

  const isImage = !!file && file.type.startsWith('image/');
  const dateRequired = isImage || needsDate;
  const close = result ? onDone : onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, sending]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) { setError('Anexe o comprovante (PDF ou foto).'); return; }
    if (dateRequired && !paidAt) { setError('Informe a data do Pix, como aparece no comprovante.'); return; }
    if (ctx.existing && !replace) { setError('Marque "Substituir o aviso existente" para continuar.'); return; }
    setSending(true);
    setError('');
    const body = new FormData();
    body.append('file', file);
    body.append('note', note);
    if (paidAt) body.append('paidAt', paidAt);
    body.append('notifyMember', String(notifyMember));
    body.append('replace', String(replace));
    const res = await fetch(`/api/invoices/${ctx.invoiceId}/receipt`, { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      if (data.code === 'paid-at-required') setNeedsDate(true);
      setError(data.error ?? 'Não foi possível registrar o comprovante.');
      return;
    }
    setResult({ check: data.receiptCheck ?? null, image: String(data.receiptType ?? '').startsWith('image/') });
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-sigma-blue-deep/70 px-4 py-6 backdrop-blur-sm" onClick={() => { if (!sending) close(); }}>
      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-sigma-card-elevated p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="receipt-dialog-title" className="text-base font-semibold text-sand-light">Registrar comprovante do irmão</h2>
            <p className="mt-1 text-xs text-sand-dark">
              {ctx.memberName} · {ctx.number}{ctx.title ? ` · ${ctx.title}` : ''} · venc. {formatDateOnly(ctx.dueDate)} · saldo em aberto <strong className="tabular-nums text-sand">{brl(ctx.balance)}</strong>
            </p>
          </div>
          <button type="button" onClick={close} disabled={sending} aria-label="Fechar" className="text-sm text-sand-dark transition hover:text-sand-light">✕</button>
        </div>

        {result ? (
          <div className="mt-5 space-y-4">
            <ResultMessage result={result} balance={ctx.balance} />
            <p className="text-xs text-sand-dark">
              O aviso está em <strong>Pagamentos → Avisos de pagamento dos irmãos</strong>, com a data de hoje e a marca de que foi registrado pela Tesouraria.
              A baixa continua sendo sua: confira o crédito no extrato.{notifyMember ? ' O irmão recebeu o e-mail de comprovante recebido e analisado.' : ''}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/dashboard/pagamentos" className="inline-flex items-center rounded-full border border-white/10 bg-sigma-blue-mid/30 px-5 py-2.5 text-sm text-sand-light transition hover:bg-sigma-blue-mid/50">Abrir Pagamentos</Link>
              <Button type="button" onClick={onDone}>Concluir</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            {ctx.existing ? (
              <Alert intent="warn">
                Já existe um aviso de pagamento desta cobrança, de {fmtDateTime(ctx.existing.at)}
                {ctx.existing.byStaff ? `, registrado por ${ctx.existing.byStaff}` : ', enviado pelo irmão no portal'}
                {ctx.existing.hasReceipt ? ', com comprovante' : ', sem comprovante'}.
                <label className="mt-2 flex items-center gap-2">
                  <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="accent-gold" />
                  Substituir o aviso existente por este comprovante
                </label>
              </Alert>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-xs text-sand-dark">Comprovante (PDF ou foto — PNG, JPG ou WebP, até 4 MB)</span>
              <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(''); }} className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-gold/15 file:px-3 file:py-1 file:text-xs file:text-gold`} />
              {isImage ? <span className="mt-1 block text-xs text-amber-300">Foto não é conferida automaticamente: você confere pela imagem e pelo extrato antes da baixa.</span> : null}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs text-sand-dark">
                Data do Pix {dateRequired ? <strong className="text-amber-300">(obrigatória)</strong> : '(no PDF o sistema tenta ler sozinho; preencha se não conseguir)'}
              </span>
              <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={`${inputClass} max-w-[12rem] ${needsDate && !paidAt ? 'border-amber-400/60' : ''}`} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs text-sand-dark">Observação (opcional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="ex.: recebido pelo WhatsApp em 29/09" className={inputClass} />
            </label>

            <label className={`flex items-center gap-2 text-sm ${ctx.memberHasEmail ? 'text-sand' : 'text-sand-dark/60'}`}>
              <input type="checkbox" checked={notifyMember} onChange={(e) => setNotifyMember(e.target.checked)} disabled={!ctx.memberHasEmail} className="accent-gold" />
              Enviar ao irmão o e-mail de comprovante recebido e analisado{ctx.memberHasEmail ? '' : ' (sem e-mail no cadastro)'}
            </label>

            {error ? <Alert intent="danger">{error}</Alert> : null}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={sending} className="mr-auto">Fechar</Button>
              <Button type="submit" disabled={sending || !file}>{sending ? 'Conferindo e registrando…' : 'Registrar comprovante'}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ResultMessage({ result, balance }: { result: { check: ReceiptCheck | null; image: boolean }; balance: number }) {
  const c = result.check;
  if (result.image) return <Alert intent="warn">Comprovante (foto) registrado. Não há conferência automática de imagem: confira pelo &quot;Ver comprovante&quot; e pelo extrato antes de dar baixa.</Alert>;
  if (!c) return <Alert intent="ok">Comprovante registrado.</Alert>;
  if (c.status === 'conferido') {
    const extra = c.amountPaid != null ? Math.round((c.amountPaid - balance) * 100) / 100 : 0;
    return (
      <Alert intent="ok">
        Comprovante conferido: ✓ identificador do Pix · ✓ valor · ✓ recebido pela loja · ✓ nº de controle {c.e2e}. Em Pagamentos, basta &quot;Confirmar e dar baixa&quot;.
        {extra > 0 ? <span className="mt-1 block">Pago com {brl(extra)} de multa e juros por atraso — a baixa lança o acréscimo à parte (1.2.06).</span> : null}
      </Alert>
    );
  }
  if (c.status === 'ilegivel') return <Alert intent="warn">Comprovante registrado, mas o PDF não tem texto legível (escaneado). Confira pela imagem e pelo extrato.</Alert>;
  const issues = [
    !c.txid && 'o identificador não é o do Pix desta cobrança',
    !c.amount && 'o valor não bate com o esperado (saldo, ou saldo com multa e juros)',
    !c.payee && 'não mostra a loja como recebedora',
    !c.e2e && 'sem nº de controle do Pix',
  ].filter(Boolean).join(' · ');
  return <Alert intent="warn">Comprovante registrado COM DIVERGÊNCIA: {issues}. Confira antes de dar baixa.</Alert>;
}
