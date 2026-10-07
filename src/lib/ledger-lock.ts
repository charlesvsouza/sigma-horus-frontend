// Regras puras da conferência do livro com o banco (trava por data) e da retificação com ciência do
// Venerável. Sem Prisma — a parte com banco está em lib/ledger-lock-server.ts. Datas são sempre o dia
// contábil (AAAA-MM-DD, lib/ledger-day.ts).
import { round2 } from '@/lib/money';

export const RECTIFICATION_TTL_MS = 48 * 60 * 60_000;

/** Quem dá a ciência: Venerável ou Administrador (o Tesoureiro pede, nunca decide). */
export function canDecideRectification(role: string | null | undefined): boolean {
  return role === 'venerable' || role === 'admin';
}

/** Quem confere o livro com o banco: o Tesoureiro (quem escreve em Contas), o Venerável e o Administrador. */
export function canConfirmCheckpoint(role: string | null | undefined): boolean {
  return role === 'treasurer' || role === 'venerable' || role === 'admin';
}

/** O dia está dentro do período já conferido? */
export function isLockedDay(dayKey: string, throughKey: string | null): boolean {
  return throughKey !== null && dayKey <= throughKey;
}

export interface RectificationLike {
  status: string;
  dateFrom: string; // AAAA-MM-DD
  dateTo: string;
  expiresAt: Date | null;
  closedAt: Date | null;
}

/** O pedido aprovado, ainda vigente, libera este dia? */
export function rectificationCovers(r: RectificationLike, dayKey: string, now: Date): boolean {
  if (r.status !== 'approved' || r.closedAt) return false;
  if (r.expiresAt && r.expiresAt.getTime() <= now.getTime()) return false;
  return dayKey >= r.dateFrom && dayKey <= r.dateTo;
}

export type DecisionCheck = { ok: true; selfApproved: boolean } | { ok: false; error: string };

/**
 * Ciência da retificação: só Venerável/Administrador; quem pediu não aprova o próprio pedido — a menos que
 * seja o ÚNICO que poderia dar a ciência (loja pequena), caso em que fica registrado como "autoaprovada".
 */
export function checkDecision(p: { requesterId: string; deciderId: string; deciderRole: string | null | undefined; eligibleApproverIds: string[] }): DecisionCheck {
  if (!canDecideRectification(p.deciderRole)) return { ok: false, error: 'Só o Venerável Mestre ou o Administrador dão a ciência de uma retificação.' };
  if (p.requesterId !== p.deciderId) return { ok: true, selfApproved: false };
  const others = p.eligibleApproverIds.filter((id) => id !== p.deciderId);
  if (others.length > 0) return { ok: false, error: 'Quem pediu a retificação não pode dar a própria ciência. Peça ao Venerável Mestre ou ao Administrador.' };
  return { ok: true, selfApproved: true };
}

export interface CheckpointBalance {
  accountId: string;
  name: string;
  informed: number;
  calculated: number;
}

export function parseCheckpointBalances(json: string): CheckpointBalance[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? (v as CheckpointBalance[]) : [];
  } catch {
    return [];
  }
}

export interface BalanceMismatch {
  accountId: string;
  name: string;
  informed: number;
  calculated: number;
  difference: number; // informado − calculado
}

/** Compara, em centavos, o saldo informado do banco com o calculado pelo sistema. */
export function compareBalances(rows: { accountId: string; name: string; informed: number; calculated: number }[]): BalanceMismatch[] {
  return rows
    .filter((r) => Math.round(r.informed * 100) !== Math.round(r.calculated * 100))
    .map((r) => ({ ...r, difference: round2(r.informed - r.calculated) }));
}

/** Mensagem padrão de bloqueio (mostrada ao tentar lançar/editar dentro do período conferido). */
export function lockedMessage(throughKey: string): string {
  const [y, m, d] = throughKey.split('-');
  return `O livro está conferido com o banco até ${d}/${m}/${y}. Para lançar, editar ou excluir com data até esse dia, o Tesoureiro pede uma retificação e o Venerável Mestre dá a ciência (Tesouraria → Conferência com o banco).`;
}
