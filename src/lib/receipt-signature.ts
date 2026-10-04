// Assinatura digital do recibo de pagamento (regras puras). Decisão do dono (2026-10-04): o recibo NÃO leva assinatura
// do pagador; leva só a do Tesoureiro (preferencialmente) ou do Venerável, em formato digital — no momento em que o
// Tesoureiro aprova/registra o pagamento o sistema grava uma marca: quem assinou, quando (data e hora), o hash
// (SHA-256) do conteúdo do recibo e um código público de verificação (RC-XXXX-XXXX), conferível em /verificar/<código>.

import { createHash, randomBytes } from 'node:crypto';

/** Quem assina recibo: só Tesoureiro e Venerável (o Administrador, sozinho, não assina). */
export function receiptSignerRole(role: string | null | undefined): 'Tesoureiro' | 'Venerável Mestre' | null {
  const r = (role ?? '').toLowerCase().trim();
  if (r === 'treasurer') return 'Tesoureiro';
  if (r === 'venerable') return 'Venerável Mestre';
  return null;
}

export interface ReceiptContent {
  paymentId: string;
  accountId: string;
  lodgeName: string;
  accountTitle: string;
  payerName: string | null;
  amount: number;
  /** Dia do pagamento (AAAA-MM-DD, calendário de Brasília). */
  paidDay: string;
  method: string;
}

/** Texto canônico do recibo: base do hash. */
export function canonicalReceipt(c: ReceiptContent): string {
  return [
    'recibo-pagamento/v1', c.paymentId, c.accountId, c.lodgeName, c.accountTitle, c.payerName ?? '', c.amount.toFixed(2), c.paidDay, c.method,
  ].join('\n');
}

export const hashReceipt = (c: ReceiptContent): string => createHash('sha256').update(canonicalReceipt(c), 'utf8').digest('hex');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1 (confundem na leitura)

/** Código público de verificação: RC-XXXX-XXXX. */
export function generateReceiptCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `RC-${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

/** Aceita o código digitado/colado (minúsculo, sem hífen) e devolve o formato canônico, ou null. */
export function normalizeReceiptCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^RC([A-Z0-9]{8})$/.exec(s);
  return m ? `RC-${m[1].slice(0, 4)}-${m[1].slice(4)}` : null;
}

/** Dia civil de Brasília de um instante, como AAAA-MM-DD. */
export function brDay(d: Date): string {
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Texto da marca impressa sob o nome, no recibo. */
export function receiptMarkText(sig: { signedAt: Date; code: string }): string {
  const when = sig.signedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' });
  return `Assinado digitalmente em ${when} · Código ${sig.code}`;
}
