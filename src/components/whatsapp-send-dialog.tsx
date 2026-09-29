'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { whatsAppUrl } from '@/lib/whatsapp-link';

// Envio da cobrança pelo WhatsApp (Modo Loja): mostra a mensagem pronta (editável), o QR e os
// atalhos de cópia; "Abrir no WhatsApp" abre a conversa do irmão pelo wa.me e o Tesoureiro
// aperta Enviar. Usado na lista de Cobranças e na página "Envio pelo WhatsApp".
// O wa.me não devolve nada: ao voltar para a aba, a janela pergunta se ele enviou — só o
// "Sim, enviei" marca a cobrança como enviada; sem resposta fica "aberta, não confirmada".

export interface WhatsAppShare {
  invoiceId: string;
  number: string;
  memberName: string;
  phone: string | null;
  rawPhone: string | null;
  amount: number;
  overdue: boolean;
  text: string;
  pixCopyPaste: string | null;
  qrDataUrl: string | null;
  hasPixKey: boolean;
}

export async function fetchWhatsAppShare(invoiceId: string): Promise<{ ok: true; share: WhatsAppShare } | { ok: false; error: string }> {
  const res = await fetch(`/api/invoices/${invoiceId}/whatsapp`);
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, share: data as WhatsAppShare } : { ok: false, error: data.error ?? 'Erro ao preparar a mensagem.' };
}

async function qrBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

function canShareFiles(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([''], 'pix.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

export type WhatsAppSendEvent = 'opened' | 'sent' | 'not-sent';

export function WhatsAppSendDialog({ share, onClose, onChange }: { share: WhatsAppShare; onClose: () => void; onChange?: (invoiceId: string, event: WhatsAppSendEvent) => void }) {
  const [text, setText] = useState(share.text);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [shareable] = useState(canShareFiles);
  // Registro "aberto" no servidor, aguardando a confirmação do Tesoureiro.
  const [logId, setLogId] = useState<string | null>(null);
  const [returned, setReturned] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Voltou para a aba depois de abrir o WhatsApp: destaca a pergunta e põe o foco no "Sim".
  useEffect(() => {
    if (!logId) return;
    const onBack = () => {
      if (document.visibilityState !== 'visible') return;
      setReturned(true);
      confirmRef.current?.focus();
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
    };
  }, [logId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function registerOpened() {
    const res = await fetch(`/api/invoices/${share.invoiceId}/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => ({})) : null;
    if (data?.logId) {
      setLogId(data.logId);
      setReturned(false);
      onChange?.(share.invoiceId, 'opened');
    }
  }

  async function confirmSent(sent: boolean) {
    if (!logId) return;
    setConfirming(true);
    const res = await fetch(`/api/invoices/${share.invoiceId}/whatsapp`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId, sent }),
    }).catch(() => null);
    setConfirming(false);
    if (!res?.ok) {
      setFeedback({ kind: 'error', text: 'Não foi possível registrar a resposta. Tente de novo.' });
      return;
    }
    setLogId(null);
    onChange?.(share.invoiceId, sent ? 'sent' : 'not-sent');
    if (sent) onClose();
    else setFeedback({ kind: 'ok', text: 'Tudo bem — a cobrança continua na fila para enviar depois.' });
  }

  function openWhatsApp() {
    // window.open primeiro, ainda dentro do clique (senão o navegador bloqueia o pop-up).
    window.open(whatsAppUrl(share.phone, text), '_blank', 'noopener');
    setFeedback(null);
    // Reabrir não cria outro registro: a mesma confirmação vale para as duas aberturas.
    if (logId) setReturned(false);
    else void registerOpened();
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({ kind: 'ok', text: `${label} copiado.` });
    } catch {
      setFeedback({ kind: 'error', text: 'Não foi possível copiar. Selecione o texto e copie manualmente.' });
    }
  }

  async function copyQr() {
    if (!share.qrDataUrl) return;
    try {
      // Promise dentro do ClipboardItem: o Safari exige que a escrita comece no próprio clique.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': qrBlob(share.qrDataUrl) })]);
      setFeedback({ kind: 'ok', text: 'QR copiado. Cole na conversa com Ctrl+V.' });
    } catch {
      setFeedback({ kind: 'error', text: 'Este navegador não copia imagens. Use "Baixar QR".' });
    }
  }

  async function shareQr() {
    if (!share.qrDataUrl) return;
    try {
      const file = new File([await qrBlob(share.qrDataUrl)], `pix-${share.number}.png`, { type: 'image/png' });
      await navigator.share({ files: [file], text });
      void registerOpened();
    } catch {
      // Cancelar a folha de compartilhamento também cai aqui — sem mensagem de erro.
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="wa-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-sigma-blue-deep/70 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-sigma-card-elevated p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="wa-dialog-title" className="text-base font-semibold text-sand-light">Enviar cobrança pelo WhatsApp</h2>
            <p className="mt-1 text-xs text-sand-dark">
              {share.memberName} · {share.phone ? share.rawPhone : 'sem celular válido no cadastro'} · {share.number} · saldo em aberto <strong className="tabular-nums text-sand">{brl(share.amount)}</strong>{share.overdue ? ' · vencida' : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-sm text-sand-dark transition hover:text-sand-light">✕</button>
        </div>

        {!share.phone ? (
          <Alert intent="warn" className="mt-4">O WhatsApp vai abrir sem destinatário: escolha o contato do irmão. Cadastre o celular dele em Membros para abrir direto na conversa.</Alert>
        ) : null}
        {!share.hasPixKey ? (
          <Alert intent="warn" className="mt-4">A loja não tem chave Pix cadastrada: a mensagem leva os dados bancários. Cadastre a chave em Configurações da loja para enviar o Pix pronto.</Alert>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-1.5 block text-xs text-sand-dark">Mensagem (pode editar antes de abrir)</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className={`${inputClass} font-mono text-xs leading-relaxed`} />
          </label>
          {share.qrDataUrl ? (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor, next/image não agrega */}
              <img src={share.qrDataUrl} alt={`QR Code Pix da cobrança ${share.number}`} width={160} height={160} className="rounded-lg bg-white p-1.5" />
              <button type="button" onClick={() => void copyQr()} className="text-xs text-gold transition hover:text-gold-light">Copiar QR</button>
              <a href={share.qrDataUrl} download={`pix-${share.number}.png`} className="text-xs text-gold transition hover:text-gold-light">Baixar QR</a>
              {shareable ? <button type="button" onClick={() => void shareQr()} className="text-xs text-gold transition hover:text-gold-light">Compartilhar QR</button> : null}
            </div>
          ) : null}
        </div>

        {feedback ? <Alert intent={feedback.kind === 'ok' ? 'ok' : 'danger'} className="mt-4">{feedback.text}</Alert> : null}

        <p className="mt-4 text-xs text-sand-dark">
          No celular o irmão não consegue escanear o QR da própria tela: o código Pix no texto é o que ele copia e cola no app do banco.
          O Pix cai direto na conta da loja e a baixa continua manual, em Pagamentos.
        </p>

        {logId ? (
          <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors ${returned ? 'border-gold/60 bg-gold/10' : 'border-white/10 bg-sigma-blue-deep/60'}`} role="status">
            <p className="text-sm text-sand-light">
              {returned ? `Enviou a mensagem para ${share.memberName}?` : 'Envie a mensagem no WhatsApp e volte aqui para confirmar.'}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void confirmSent(false)} disabled={confirming}>Não enviei</Button>
              <Button ref={confirmRef} type="button" size="sm" onClick={() => void confirmSent(true)} disabled={confirming}>Sim, enviei</Button>
            </div>
            <p className="w-full text-xs text-sand-dark">Se fechar sem responder, a cobrança fica como &quot;aberta, não confirmada&quot; e continua na fila.</p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="mr-auto">Fechar</Button>
          {share.pixCopyPaste ? <Button type="button" variant="secondary" size="sm" onClick={() => void copyText(share.pixCopyPaste!, 'Código Pix')}>Copiar código Pix</Button> : null}
          <Button type="button" variant="secondary" size="sm" onClick={() => void copyText(text, 'Mensagem')}>Copiar mensagem</Button>
          <Button type="button" variant={logId ? 'secondary' : 'primary'} onClick={openWhatsApp}>{logId ? 'Abrir de novo' : 'Abrir no WhatsApp'}</Button>
        </div>
      </div>
    </div>
  );
}
