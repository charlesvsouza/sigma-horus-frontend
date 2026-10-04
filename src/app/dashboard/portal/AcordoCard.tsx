'use client';

import { useState } from 'react';
import { Alert, Badge, Button } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';

// "Meu acordo": o irmão com acordo em aberto (quitação de dívidas ou regularização) vê as parcelas e paga cada
// uma com o Pix da chave da loja (QR ou copia e cola). O Pix cai direto na conta da loja: depois de pagar, "Já paguei"
// avisa a Tesouraria, que confere e dá a baixa.

export interface PortalAgreementView {
  id: string;
  kind: string;
  kindLabel: string;
  total: number;
  paid: number;
  remaining: number;
  installments: number;
  hasPixKey: boolean;
  charges: { target: string; number: number; amount: number; dueDate: string; late: boolean; noticeAt: string | null }[];
}

interface PixResult { amount: number; dueDate: string; late: boolean; pixCopyPaste: string; qrImage: string }

export function AcordoCard({ agreement, onChanged }: { agreement: PortalAgreementView; onChanged: () => void }) {
  const [openTarget, setOpenTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<PixResult | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const pct = agreement.total > 0 ? Math.min(100, Math.round((agreement.paid / agreement.total) * 100)) : 0;

  async function pay(target: string) {
    if (openTarget === target && result) { setOpenTarget(null); setResult(null); return; }
    setOpenTarget(target); setResult(null); setError(''); setInfo(''); setBusy(target);
    const res = await fetch('/api/portal/agreement/charge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? 'Não foi possível gerar o Pix.');
    setResult(data as PixResult);
  }

  async function copy() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.pixCopyPaste); setInfo('Pix copia e cola copiado.'); } catch { setInfo('Selecione o código e copie.'); }
  }

  async function notice(target: string) {
    setBusy(`n-${target}`); setError(''); setInfo('');
    const res = await fetch('/api/portal/agreement/paid-notice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? 'Não foi possível avisar a Tesouraria.');
    setInfo('Aviso enviado à Tesouraria. Assim que ela confirmar o recebimento, a parcela some desta lista.');
    onChanged();
  }

  return (
    <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-sand-light">Meu acordo</h2>
          <p className="mt-0.5 text-xs text-gold">{agreement.kindLabel}</p>
        </div>
        <Badge variant="warning">Saldo {brl(agreement.remaining)}</Badge>
      </div>
      <p className="mt-2 text-xs text-sand-dark">
        As dívidas incluídas no acordo são pagas pelas parcelas abaixo, no Pix da loja. O que você pagar abate o acordo.
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Quanto do acordo já foi pago">
        <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-sand-dark">Total {brl(agreement.total)} · pago {brl(agreement.paid)} · {agreement.installments > 1 ? `${agreement.installments} parcelas` : 'à vista'}</p>

      {!agreement.hasPixKey ? <Alert intent="warn" className="mt-3">A loja ainda não cadastrou a chave Pix. Fale com a Tesouraria para saber como pagar.</Alert> : null}
      {error ? <Alert intent="danger" className="mt-3">{error}</Alert> : null}
      {info ? <Alert intent="ok" className="mt-3">{info}</Alert> : null}

      <ul className="mt-4 space-y-3">
        {agreement.charges.map((c) => {
          const label = c.target === 'balance' ? 'Quitar o saldo todo do acordo' : `Parcela ${c.number}/${agreement.installments}`;
          return (
            <li key={c.target} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-sand">
                  <p>{label} · <span className="tabular-nums font-medium text-sand-light">{brl(c.amount)}</span></p>
                  <p className="text-xs text-sand-dark">{c.target === 'balance' ? 'Pague tudo de uma vez' : `Vence em ${formatDateOnly(c.dueDate)}`}{c.late ? <span className="ml-1 text-rose-300">· atrasada</span> : null}</p>
                  {c.noticeAt ? <p className="text-xs text-emerald-300">Aviso enviado em {formatDateOnly(c.noticeAt)} — aguardando confirmação da Tesouraria</p> : null}
                </div>
                {agreement.hasPixKey ? (
                  <Button type="button" size="sm" onClick={() => void pay(c.target)} disabled={busy === c.target}>
                    {busy === c.target ? 'Gerando…' : openTarget === c.target && result ? 'Fechar' : 'Pagar'}
                  </Button>
                ) : null}
              </div>
              {openTarget === c.target && result ? (
                <div className="mt-3 grid gap-3 md:grid-cols-[auto_1fr]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result.qrImage} alt="QR Code do Pix" width={160} height={160} className="rounded bg-white p-1" />
                  <div className="min-w-0">
                    <p className="text-sm text-sand">Pague <strong className="tabular-nums text-gold">{brl(result.amount)}</strong> pelo app do seu banco: escaneie o QR ou use o Pix copia e cola.</p>
                    <textarea readOnly value={result.pixCopyPaste} rows={3} onFocus={(e) => e.currentTarget.select()} className="mt-2 w-full rounded-lg border border-white/10 bg-sigma-blue-deep/60 p-2 font-mono text-[11px] text-sand" aria-label="Pix copia e cola" />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => void copy()}>Copiar Pix</Button>
                      <Button type="button" size="sm" onClick={() => void notice(c.target)} disabled={busy === `n-${c.target}`}>{busy === `n-${c.target}` ? 'Enviando…' : 'Já paguei'}</Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
