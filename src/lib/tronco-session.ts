// Tronco de Solidariedade por sessão — regras puras. Decisões do dono (2026-10-04): o total do Tronco é por sessão e todos os
// cargos o veem (sem doador); declarar a entrada: Hospitaleiro (fica aguardando) e Tesoureiro/Venerável/Administrador;
// confirmar (lançar no caixa): só Tesoureiro, Venerável e Administrador; o Secretário não lança nem confirma.

import { randomBytes } from 'node:crypto';

export type TroncoSource = 'members' | 'visitors' | 'mixed';
export const TRONCO_SOURCES: TroncoSource[] = ['members', 'visitors', 'mixed'];
export const TRONCO_SOURCE_LABEL: Record<TroncoSource, string> = { members: 'Obreiros', visitors: 'Visitantes', mixed: 'Obreiros e visitantes (sem divisão)' };
export const isTroncoSource = (v: unknown): v is TroncoSource => v === 'members' || v === 'visitors' || v === 'mixed';

export type TroncoChannel = 'cash' | 'pix' | 'pix_qr' | 'pix_portal' | 'other';
export const TRONCO_CHANNEL_LABEL: Record<TroncoChannel, string> = { cash: 'Dinheiro (sacola)', pix: 'Pix', pix_qr: 'Pix do QR da sessão', pix_portal: 'Pix pelo portal', other: 'Outro' };

const norm = (role: string | null | undefined) => (role ?? '').toLowerCase().trim();

/** Quem lança no caixa / confirma / recusa uma entrada do Tronco. */
export const canConfirmTronco = (role: string | null | undefined) => ['admin', 'venerable', 'treasurer'].includes(norm(role));
/** Quem declara uma entrada: os que confirmam (já entra confirmada) e o Hospitaleiro (fica aguardando confirmação). */
export const canDeclareTronco = (role: string | null | undefined) => canConfirmTronco(role) || norm(role) === 'hospitaller';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** DNA da entrada: TR-XXXX-XXXX (sem I, O, 0, 1). */
export function generateTroncoCode(): string {
  const chars = Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]);
  return `TR-${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

export interface SessionLike { id: string; title: string; date: Date; endDate?: Date | null }

const HOUR = 3_600_000;
/** A sessão "em curso": do começo (2 h antes) até o fim previsto + 3 h (sem fim cadastrado, 4 h de duração). */
export function sessionWindow(s: SessionLike): { start: number; end: number } {
  const startsAt = s.date.getTime();
  const endsAt = s.endDate ? s.endDate.getTime() : startsAt + 4 * HOUR;
  return { start: startsAt - 2 * HOUR, end: endsAt + 3 * HOUR };
}

const brDay = (d: Date) => new Date(d.getTime() - 3 * HOUR).toISOString().slice(0, 10);

/**
 * Sessão ativa agora: a que está na janela (a de início mais recente, se houver duas); sem nenhuma na janela, a do mesmo dia
 * civil de Brasília mais próxima do momento; senão null (a entrada fica "sem sessão", como Tronco avulso).
 */
export function activeSessionFor(sessions: SessionLike[], now: Date): SessionLike | null {
  const t = now.getTime();
  const inWindow = sessions.filter((s) => { const w = sessionWindow(s); return t >= w.start && t <= w.end; });
  if (inWindow.length > 0) return inWindow.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  const today = brDay(now);
  const sameDay = sessions.filter((s) => brDay(s.date) === today);
  if (sameDay.length === 0) return null;
  return sameDay.sort((a, b) => Math.abs(a.date.getTime() - t) - Math.abs(b.date.getTime() - t))[0];
}

export interface TroncoSessionRow {
  sessionId: string | null;
  confirmed: number;
  pending: number;
  bySource: Record<TroncoSource, number>;
}

const cents = (n: number) => Math.round(n * 100);

/** Soma, por sessão, o confirmado, o aguardando e a divisão por origem (só do confirmado). Entradas sem sessão ficam em `null`. */
export function summarizeBySession(
  entries: { sessionId: string | null; amount: number; status: string; source: TroncoSource | null }[],
): TroncoSessionRow[] {
  const map = new Map<string, { row: TroncoSessionRow; c: number; p: number; s: Record<TroncoSource, number> }>();
  for (const e of entries) {
    if (e.status === 'rejected') continue;
    const key = e.sessionId ?? '__none';
    const cur = map.get(key) ?? { row: { sessionId: e.sessionId, confirmed: 0, pending: 0, bySource: { members: 0, visitors: 0, mixed: 0 } }, c: 0, p: 0, s: { members: 0, visitors: 0, mixed: 0 } };
    if (e.status === 'confirmed') { cur.c += cents(e.amount); cur.s[e.source ?? 'mixed'] += cents(e.amount); }
    else cur.p += cents(e.amount);
    map.set(key, cur);
  }
  return [...map.values()].map(({ row, c, p, s }) => ({ ...row, confirmed: c / 100, pending: p / 100, bySource: { members: s.members / 100, visitors: s.visitors / 100, mixed: s.mixed / 100 } }));
}
