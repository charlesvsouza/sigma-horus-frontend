'use client';

import { useState } from 'react';
import { Alert, Badge, Button, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { daysOverdueBR, formatDateOnly } from '@/lib/date-only';

// "Minhas pendências": o irmão vê o que deve à loja e paga ali mesmo — no Modo Asaas
// com o Pix da cobrança (emitida na hora, se a Tesouraria ainda não emitiu; baixa
// automática), no Modo Loja com o Pix na chave da loja (baixa manual, com "Já paguei").

export interface PendingAccount {
  id: string;
  title: string;
  dueDate: string;
  effectiveStatus: 'paid' | 'overdue' | 'pending';
  balance: number;
  paidNoticeAt?: string | null;
  chartAccount?: { name: string; category: string | null } | null;
}

export interface CollectionInfo {
  mode: 'lodge' | 'asaas';
  hasPixKey: boolean;
}

interface PayResult {
  mode: 'lodge' | 'asaas';
  amount: number;
  pixCopyPaste: string | null;
  qrImage: string | null;
  invoiceUrl?: string | null;
  instructions?: string | null;
}

export function PendenciasCard({
  accounts,
  collection,
  onChanged,
}: {
  accounts: PendingAccount[];
  collection: CollectionInfo | null;
  onChanged: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');
  const [noticeMsg, setNoticeMsg] = useState('');
  const [sendingNotice, setSendingNotice] = useState(false);

  const total = accounts.reduce((sum, a) => sum + a.balance, 0);
  const canPayOnline = collection?.mode === 'asaas' || Boolean(collection?.hasPixKey);

  function close() {
    setOpenId(null);
    setResult(null);
    setError('');
    setCopied(false);
    setNote('');
    setNoticeMsg('');
  }

  async function pay(id: string) {
    if (openId === id && result) { close(); return; }
    close();
    setOpenId(id);
    setBusyId(id);
    const res = await fetch(`/api/portal/accounts/${id}/pay`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) { setError(data.error ?? 'Não foi possível gerar o pagamento.'); return; }
    setResult(data as PayResult);
  }

  async function copy() {
    if (!result?.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(result.pixCopyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  async function sendNotice(id: string) {
    setSendingNotice(true);
    setNoticeMsg('');
    const res = await fetch(`/api/portal/accounts/${id}/paid-notice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    const data = await res.json().catch(() => ({}));
    setSendingNotice(false);
    if (!res.ok) { setError(data.error ?? 'Não foi possível avisar a Tesouraria.'); return; }
    setNoticeMsg('Tesouraria avisada. A baixa é feita depois de conferir o extrato da loja.');
    onChanged();
  }

  return (
    <section className="rounded-xl border border-white/6 bg-sigma-card p-6" aria-labelledby="pendencias-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="pendencias-title" className="text-base font-semibold text-sand-light">Minhas pendências</h2>
          <p className="mt-0.5 text-xs text-sand-dark">
            {accounts.length === 0
              ? 'Nenhuma conta em aberto. Tudo em dia.'
              : `${accounts.length} conta${accounts.length !== 1 ? 's' : ''} em aberto`}
          </p>
        </div>
        {accounts.length > 0 ? (
          <p className="text-right">
            <span className="block text-xs uppercase tracking-[0.25em] text-gold">Total em aberto</span>
            <span className="text-xl font-semibold text-sand-light">{brl(total)}</span>
          </p>
        ) : null}
      </div>

      {accounts.length > 0 && !canPayOnline ? (
        <p className="mt-4 text-sm text-sand-dark">Para pagar, fale com a Tesouraria da loja.</p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {accounts.map((a) => {
          const days = a.effectiveStatus === 'overdue' ? daysOverdueBR(a.dueDate) : 0;
          const isOpen = openId === a.id;
          return (
            <li key={a.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sand-light">{a.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sand-dark">
                    <span>Vence em {formatDateOnly(a.dueDate)}</span>
                    {a.effectiveStatus === 'overdue' ? (
                      <Badge variant="overdue">Vencida há {days} dia{days !== 1 ? 's' : ''}</Badge>
                    ) : (
                      <Badge variant="pending">Em aberto</Badge>
                    )}
                  </p>
                  {a.paidNoticeAt ? (
                    <p className="mt-1 text-xs text-sky-200">Você avisou o pagamento em {new Date(a.paidNoticeAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}. Aguardando a Tesouraria.</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-sand-light">{brl(a.balance)}</p>
                  {canPayOnline ? (
                    <Button size="sm" onClick={() => void pay(a.id)} disabled={busyId === a.id} aria-expanded={isOpen}>
                      {busyId === a.id ? 'Gerando…' : isOpen && result ? 'Fechar' : 'Pagar'}
                    </Button>
                  ) : null}
                </div>
              </div>

              {isOpen && error ? <Alert intent="danger" className="mt-4">{error}</Alert> : null}

              {isOpen && result ? (
                <div className="mt-4 grid gap-4 rounded-lg border border-gold/20 bg-sigma-blue-deep/70 p-4 sm:grid-cols-[auto_1fr]">
                  {result.qrImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- QR em data URL
                    <img src={result.qrImage} alt={`QR Code Pix de ${brl(result.amount)}`} width={176} height={176} className="mx-auto rounded-lg bg-white p-2 sm:mx-0" />
                  ) : null}
                  <div className="min-w-0 space-y-3">
                    <p className="text-sand-light">
                      Pix de <strong>{brl(result.amount)}</strong>: aponte a câmera do app do banco para o QR ou copie o código.
                    </p>
                    {result.pixCopyPaste ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input readOnly value={result.pixCopyPaste} onFocus={(e) => e.currentTarget.select()} aria-label="Pix copia e cola" className={`${inputClass} min-w-0 flex-1 font-mono text-xs`} />
                        <Button size="sm" variant="secondary" onClick={() => void copy()}>{copied ? 'Copiado!' : 'Copiar código'}</Button>
                      </div>
                    ) : null}
                    {result.mode === 'asaas' ? (
                      <>
                        {result.invoiceUrl ? (
                          <a href={result.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex text-xs text-gold hover:text-gold-light">Abrir a cobrança no Asaas</a>
                        ) : null}
                        <p className="text-xs text-sand-dark">A confirmação é automática: depois do Pix, a conta sai das pendências em instantes e o recibo fica no seu extrato.</p>
                      </>
                    ) : (
                      <>
                        {result.instructions ? <p className="whitespace-pre-line text-xs text-sand-dark">{result.instructions}</p> : null}
                        <p className="text-xs text-sand-dark">O Pix cai direto na conta da loja. Depois de pagar, avise a Tesouraria, que confere o extrato e dá a baixa.</p>
                        {noticeMsg ? (
                          <Alert intent="ok">{noticeMsg}</Alert>
                        ) : (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Observação (opcional)" aria-label="Observação para a Tesouraria" className={`${inputClass} min-w-0 flex-1 text-xs`} />
                            <Button size="sm" variant="secondary" onClick={() => void sendNotice(a.id)} disabled={sendingNotice}>
                              {sendingNotice ? 'Enviando…' : 'Já paguei'}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
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
