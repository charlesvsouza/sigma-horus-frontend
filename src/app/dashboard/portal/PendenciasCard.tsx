'use client';

import { useState } from 'react';
import { Alert, Badge, Button, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { daysOverdueBR, formatDateOnly } from '@/lib/date-only';
import { receiptUploadError } from '@/lib/upload-guards';

// "Minhas pendências": o irmão vê o que deve à loja e paga ali mesmo — no Modo Asaas
// com o Pix da cobrança (emitida na hora, se a Tesouraria ainda não emitiu; baixa
// automática), no Modo Loja com o Pix na chave da loja (baixa manual, com "Já paguei").
// Com duas ou mais pendências, dá para marcar várias e pagar com UM Pix.

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
  /** Modo Loja com multa e juros: valor original e o acréscimo incluído no Pix. */
  principal?: number;
  lateCharge?: number;
  pixCopyPaste: string | null;
  qrImage: string | null;
  invoiceUrl?: string | null;
  instructions?: string | null;
}

const GROUP = 'group';

export function PendenciasCard({
  accounts,
  collection,
  onChanged,
}: {
  accounts: PendingAccount[];
  collection: CollectionInfo | null;
  onChanged: () => void;
}) {
  // Painel aberto: o id de uma conta, ou GROUP (as selecionadas, num Pix só).
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [noticeMsg, setNoticeMsg] = useState('');
  const [sendingNotice, setSendingNotice] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  // Contas do Pix agrupado aberto (congeladas no clique: a seleção pode mudar depois).
  const [groupIds, setGroupIds] = useState<string[]>([]);

  const total = accounts.reduce((sum, a) => sum + a.balance, 0);
  const canPayOnline = collection?.mode === 'asaas' || Boolean(collection?.hasPixKey);
  const canGroup = canPayOnline && accounts.length >= 2;
  const chosen = accounts.filter((a) => selected.includes(a.id));
  const chosenTotal = chosen.reduce((sum, a) => sum + a.balance, 0);

  function close() {
    setOpenId(null);
    setResult(null);
    setError('');
    setCopied(false);
    setNote('');
    setReceipt(null);
    setNoticeMsg('');
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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

  async function payGroup() {
    if (openId === GROUP && result) { close(); return; }
    close();
    const ids = chosen.map((a) => a.id);
    setGroupIds(ids);
    setOpenId(GROUP);
    setBusyId(GROUP);
    const res = await fetch('/api/portal/pay-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountIds: ids }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) { setError(data.error ?? 'Não foi possível gerar o Pix das selecionadas.'); return; }
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

  async function sendNotice() {
    if (!openId) return;
    setSendingNotice(true);
    setNoticeMsg('');
    // Com comprovante vai como formulário (multipart); o navegador põe o Content-Type.
    const form = new FormData();
    form.append('note', note);
    if (receipt) form.append('file', receipt);
    let url = `/api/portal/accounts/${openId}/paid-notice`;
    if (openId === GROUP) {
      url = '/api/portal/paid-notice-group';
      form.append('accountIds', JSON.stringify(groupIds));
    }
    const res = await fetch(url, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    setSendingNotice(false);
    if (!res.ok) { setError(data.error ?? 'Não foi possível avisar a Tesouraria.'); return; }
    setNoticeMsg('Tesouraria avisada. A baixa é feita depois de conferir o extrato da loja.');
    onChanged();
  }

  function pickReceipt(f: File | null) {
    const invalid = f ? receiptUploadError(f) : null;
    if (invalid) { setError(invalid); setReceipt(null); return; }
    setError('');
    setReceipt(f);
  }

  function panel(forGroup: boolean) {
    if (!result) return null;
    return (
      <div className="mt-4 grid gap-4 rounded-lg border border-gold/20 bg-sigma-blue-deep/70 p-4 sm:grid-cols-[auto_1fr]">
        {result.qrImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- QR em data URL
          <img src={result.qrImage} alt={`QR Code Pix de ${brl(result.amount)}`} width={176} height={176} className="mx-auto rounded-lg bg-white p-2 sm:mx-0" />
        ) : null}
        <div className="min-w-0 space-y-3">
          <p className="text-sand-light">
            Pix de <strong>{brl(result.amount)}</strong>{forGroup ? <> para as <strong>{groupIds.length} contas</strong> selecionadas</> : null}: aponte a câmera do app do banco para o QR ou copie o código.
          </p>
          {result.lateCharge && result.lateCharge > 0 ? (
            <p className="text-xs text-amber-300">
              Inclui {brl(result.lateCharge)} de multa e juros por atraso sobre {brl(result.principal ?? result.amount - result.lateCharge)}, calculados até hoje (regra da loja).
            </p>
          ) : null}
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
              <p className="text-xs text-sand-dark">
                A confirmação é automática: depois do Pix, {forGroup ? 'as contas saem' : 'a conta sai'} das pendências em instantes e o recibo fica no seu extrato.
              </p>
            </>
          ) : (
            <>
              {result.instructions ? <p className="whitespace-pre-line text-xs text-sand-dark">{result.instructions}</p> : null}
              <p className="text-xs text-sand-dark">O Pix cai direto na conta da loja. Depois de pagar, avise a Tesouraria, que confere o extrato e dá a baixa.</p>
              {noticeMsg ? (
                <Alert intent="ok">{noticeMsg}</Alert>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Observação (opcional)" aria-label="Observação para a Tesouraria" className={`${inputClass} min-w-0 flex-1 text-xs`} />
                    <Button size="sm" variant="secondary" onClick={() => void sendNotice()} disabled={sendingNotice}>
                      {sendingNotice ? 'Enviando…' : 'Já paguei'}
                    </Button>
                  </div>
                  <label className="flex cursor-pointer flex-wrap items-center gap-2 text-xs text-sand-dark">
                    <span className="rounded-full border border-gold/40 px-3 py-1 font-medium text-gold/80 hover:border-gold/60 hover:text-gold">
                      {receipt ? 'Trocar comprovante' : 'Anexar comprovante (opcional)'}
                    </span>
                    <span className="min-w-0 truncate">{receipt ? receipt.name : 'foto ou PDF, até 4 MB'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; pickReceipt(f); }}
                    />
                  </label>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
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

      {canGroup ? (
        <div className="mt-4 rounded-lg border border-white/8 bg-sigma-blue-deep/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-sand-dark">
              {chosen.length >= 2
                ? <>Marcadas: <strong className="text-sand-light">{chosen.length}</strong> · <strong className="text-sand-light">{brl(chosenTotal)}</strong></>
                : 'Marque duas ou mais contas para pagar com um Pix só.'}
            </p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSelected(selected.length === accounts.length ? [] : accounts.map((a) => a.id))} className="text-xs text-gold hover:text-gold-light">
                {selected.length === accounts.length ? 'Desmarcar todas' : 'Marcar todas'}
              </button>
              <Button size="sm" onClick={() => void payGroup()} disabled={chosen.length < 2 || busyId === GROUP} aria-expanded={openId === GROUP}>
                {busyId === GROUP ? 'Gerando…' : openId === GROUP && result ? 'Fechar' : 'Pagar selecionadas'}
              </Button>
            </div>
          </div>
          {openId === GROUP && error ? <Alert intent="danger" className="mt-4">{error}</Alert> : null}
          {openId === GROUP ? panel(true) : null}
        </div>
      ) : null}

      <ul className="mt-4 space-y-3">
        {accounts.map((a) => {
          const days = a.effectiveStatus === 'overdue' ? daysOverdueBR(a.dueDate) : 0;
          const isOpen = openId === a.id;
          return (
            <li key={a.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {canGroup ? (
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      onChange={() => toggle(a.id)}
                      aria-label={`Marcar ${a.title} de ${formatDateOnly(a.dueDate)} para pagar junto`}
                      className="mt-1 h-4 w-4 shrink-0 accent-gold"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="font-medium text-sand-light">{a.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sand-dark">
                      <span>Vence em {formatDateOnly(a.dueDate)}</span>
                      {a.paidNoticeAt ? (
                        <Badge variant="billed">Aguardando confirmação da Tesouraria</Badge>
                      ) : a.effectiveStatus === 'overdue' ? (
                        <Badge variant="overdue">Vencida há {days} dia{days !== 1 ? 's' : ''}</Badge>
                      ) : (
                        <Badge variant="pending">Em aberto</Badge>
                      )}
                    </p>
                    {a.paidNoticeAt ? (
                      <p className="mt-1 text-xs text-sky-200">Você avisou o pagamento em {new Date(a.paidNoticeAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}. Aguardando a Tesouraria.</p>
                    ) : null}
                  </div>
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
              {isOpen ? panel(false) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
