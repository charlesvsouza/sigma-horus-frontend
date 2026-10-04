// QR Pix estático do Tronco de Solidariedade por sessão — regras puras. Decisões do dono (2026-10-04): um QR por sessão e por
// origem (livro de presença dos obreiros / lista de visitantes), valor livre, sem página pública, expira à meia-noite de
// Brasília do dia da sessão.

import type { TroncoSource } from '@/lib/tronco-session';

const HOUR = 3_600_000;
/** Dia civil de Brasília (AAAA-MM-DD) de um instante. */
const brDay = (d: Date) => new Date(d.getTime() - 3 * HOUR).toISOString().slice(0, 10);

/** Validade do QR: 00:00 (Brasília) do dia seguinte ao da sessão — o QR vale até o fim do dia da sessão. */
export function qrExpiryFor(sessionDate: Date): Date {
  const [y, m, d] = brDay(sessionDate).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 3, 0, 0)); // 00:00 BRT = 03:00 UTC
}

/** Data de expiração no formato do Asaas ("YYYY-MM-DD HH:mm:ss", horário de Brasília). */
export function asaasExpiration(expiresAt: Date): string {
  return new Date(expiresAt.getTime() - 3 * HOUR).toISOString().slice(0, 19).replace('T', ' ');
}

export type QrState = 'active' | 'expired';
export const qrState = (expiresAt: Date, now: Date): QrState => (expiresAt.getTime() > now.getTime() ? 'active' : 'expired');

export type QrSource = Extract<TroncoSource, 'members' | 'visitors'>;
export const QR_SOURCES: QrSource[] = ['members', 'visitors'];
const SOURCE_NAME: Record<QrSource, string> = { members: 'obreiros', visitors: 'visitantes' };

/** Descrição do QR no Asaas: sem acentos e com no máximo 37 caracteres (limite da API, conferido na sandbox). */
export function qrDescription(session: { title: string; date: Date }, source: QrSource): string {
  const [y, m, d] = brDay(session.date).split('-');
  return `Tronco ${d}/${m}/${y.slice(2)} - ${SOURCE_NAME[source]}`;
}

/** Referência externa do QR (liga ao registro local em conferências manuais). */
export const qrExternalReference = (lodgeId: string, sessionId: string, source: QrSource) => `tronco:${lodgeId}:${sessionId}:${source}`;

/** Status do pagamento que conta como dinheiro recebido. */
export const QR_PAID_STATUSES = ['RECEIVED', 'CONFIRMED'];
