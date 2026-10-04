'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { whatsAppUrl } from '@/lib/whatsapp-link';

interface Prepared {
  memberName: string;
  phone: string | null;
  rawPhone: string | null;
  email: string | null;
  amount: number;
  late: boolean;
  dueDate: string;
  pixCopyPaste: string;
  qrDataUrl: string;
  text: string;
}

// Cobrança de uma parcela (ou do saldo) do acordo: QR + Pix copia e cola na chave da loja, para copiar,
// enviar por WhatsApp (wa.me — quem envia é a pessoa) ou por e-mail. Vale em qualquer modo de recebimento.
export default function AgreementChargePanel({ memberId, target, label, onClose, onSent }: {
  memberId: string;
  target: string;
  label: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [data, setData] = useState<Prepared | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingLogId, setPendingLogId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/members/${memberId}/block/charge?target=${encodeURIComponent(target)}`)
      .then(async (res) => ({ res, body: await res.json().catch(() => ({})) }))
      .then(({ res, body }) => {
        if (!alive) return;
        if (res.ok) setData(body as Prepared);
        else setError(body.error ?? 'Não foi possível gerar a cobrança.');
      })
      .catch(() => alive && setError('Não foi possível gerar a cobrança.'));
    return () => { alive = false; };
  }, [memberId, target]);

  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.pixCopyPaste);
      setInfo('Pix copia e cola copiado.');
    } catch {
      setInfo('Não consegui copiar automaticamente: selecione o código e copie.');
    }
  }

  async function sendWhatsApp() {
    if (!data) return;
    setBusy(true);
    setError('');
    const res = await fetch(`/api/members/${memberId}/block/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, channel: 'whatsapp', text: data.text }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? 'Não foi possível abrir o WhatsApp.');
    setPendingLogId(body.logId);
    window.open(whatsAppUrl(data.phone, data.text), '_blank', 'noopener');
  }

  async function confirmWhatsApp(sent: boolean) {
    if (!pendingLogId) return;
    const res = await fetch(`/api/members/${memberId}/block/charge`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId: pendingLogId, sent }),
    });
    setPendingLogId(null);
    if (res.ok) {
      setInfo(sent ? 'Envio registrado.' : 'Nada foi registrado.');
      if (sent) onSent();
    }
  }

  async function sendEmail() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/members/${memberId}/block/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, channel: 'email' }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setInfo(`E-mail enviado para ${body.to}.`);
      onSent();
    } else setError(body.error ?? 'Não foi possível enviar o e-mail.');
  }

  return (
    <div className="mt-2 rounded-lg border border-gold/20 bg-gold/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-sand-light">{label}</p>
        <button type="button" onClick={onClose} className="text-xs text-sand-dark hover:text-sand-light">Fechar</button>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      {!data && !error ? <p className="mt-2 text-xs text-sand-dark">Gerando a cobrança…</p> : null}
      {data ? (
        <div className="mt-2 grid gap-3 md:grid-cols-[auto_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.qrDataUrl} alt="QR Code do Pix" width={160} height={160} className="rounded bg-white p-1" />
          <div className="min-w-0">
            <p className="text-sm text-sand">
              <strong className="tabular-nums text-gold">{brl(data.amount)}</strong> · {data.late ? 'vencida em' : 'vence em'} {formatDateOnly(data.dueDate)}
            </p>
            <textarea readOnly value={data.pixCopyPaste} rows={3} onFocus={(e) => e.currentTarget.select()} className="mt-2 w-full rounded-lg border border-white/10 bg-sigma-blue-deep/60 p-2 font-mono text-[11px] text-sand" aria-label="Pix copia e cola" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={() => void copy()}>Copiar Pix</Button>
              <Button type="button" size="sm" onClick={() => void sendWhatsApp()} disabled={busy || pendingLogId != null}>Enviar por WhatsApp</Button>
              <Button type="button" size="sm" onClick={() => void sendEmail()} disabled={busy || !data.email} title={data.email ? undefined : 'O irmão não tem e-mail cadastrado.'}>Enviar por e-mail</Button>
            </div>
            {!data.phone ? <p className="mt-2 text-xs text-sand-dark">Sem celular válido no cadastro{data.rawPhone ? ` (“${data.rawPhone}”)` : ''}: o WhatsApp abre sem contato e você escolhe a conversa.</p> : null}
            {pendingLogId ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-sand">
                Você enviou a mensagem no WhatsApp?
                <Button type="button" size="sm" onClick={() => void confirmWhatsApp(true)}>Sim, enviei</Button>
                <Button type="button" size="sm" onClick={() => void confirmWhatsApp(false)}>Não enviei</Button>
              </p>
            ) : null}
            {info ? <p className="mt-2 text-xs text-emerald-300">{info}</p> : null}
            <p className="mt-2 text-xs text-sand-dark">O Pix cai direto na conta da loja e o sistema não fica sabendo: confirme o recebimento em “Registrar pagamento do acordo”.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
