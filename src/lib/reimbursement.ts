import { parseDateInput } from './date-only';
import { isValidMoney, round2 } from './money';
const normalizeRole = (role: string | null | undefined) => (role ?? '').toLowerCase().trim();

// Pedido de reembolso: regras puras (sem banco). O fluxo e o porquê estão em prisma/schema.prisma (model Reimbursement).
//
//   irmão ──► rascunho ──envia (≥1 anexo)──► enviado ──Tesouraria confere──► aguardando o Venerável ──► aprovado ──► pago
//                                              │  └─ devolve ao irmão (motivo) ─► devolvido ─┐              └─ rejeitado (motivo)
//                                              └────────────── irmão corrige e reenvia ◄─────┘
//   Tesoureiro digita em nome do irmão: pula a própria conferência e vai direto ao Venerável.
//   Venerável/Administrador digita em nome de outro irmão: a aprovação é implícita (nasce aprovado).

export const REIMBURSEMENT_STATUSES = ['draft', 'submitted', 'returned', 'awaiting_vm', 'approved', 'rejected', 'paid', 'cancelled'] as const;
export type ReimbursementStatus = (typeof REIMBURSEMENT_STATUSES)[number];

export const REIMBURSEMENT_LABEL: Record<ReimbursementStatus, string> = {
  draft: 'Rascunho (não enviado)',
  submitted: 'Aguardando conferência da Tesouraria',
  returned: 'Devolvido para correção',
  awaiting_vm: 'Aguardando o Venerável',
  approved: 'Autorizado — a pagar',
  rejected: 'Rejeitado',
  paid: 'Reembolsado',
  cancelled: 'Cancelado',
};

export type ReimbursementTone = 'info' | 'warning' | 'success' | 'error' | 'canceled';
export const REIMBURSEMENT_TONE: Record<ReimbursementStatus, ReimbursementTone> = {
  draft: 'canceled', submitted: 'warning', returned: 'warning', awaiting_vm: 'info', approved: 'info', rejected: 'error', paid: 'success', cancelled: 'canceled',
};

export const isReimbursementStatus = (v: unknown): v is ReimbursementStatus => typeof v === 'string' && (REIMBURSEMENT_STATUSES as readonly string[]).includes(v);

/** Anexos por pedido (uma nota = um pedido; até 3 arquivos, ex.: frente, verso e foto do cupom). */
export const MAX_REIMBURSEMENT_FILES = 3;

/** Quem situações de irmão aceita pedir reembolso: o bloqueado (Art. 002) pode — o Venerável vê a dívida aberta ao decidir. */
export const REQUESTER_MEMBER_STATUSES = ['active', 'blocked'];
export const canRequestReimbursement = (memberStatus: string | null | undefined) => REQUESTER_MEMBER_STATUSES.includes(memberStatus ?? '');

export interface ReimbursementInput {
  description: string;
  vendorName: string | null;
  amount: number;
  expenseDate: Date;
  chartAccountId: string | null;
}

export type InputCheck = { ok: true; value: ReimbursementInput } | { ok: false; error: string };

/** Lê e confere os campos do pedido. `today` = hoje em Brasília (só dia): a data do gasto não pode ser futura. */
export function checkReimbursementInput(raw: unknown, today: Date): InputCheck {
  const b = (raw ?? {}) as Record<string, unknown>;
  const description = String(b.description ?? '').trim();
  if (description.length < 3) return { ok: false, error: 'Descreva o gasto (o que foi comprado e para que serviu).' };
  if (description.length > 300) return { ok: false, error: 'A descrição passa de 300 caracteres. Resuma.' };
  const vendor = String(b.vendorName ?? '').trim();
  if (vendor.length > 120) return { ok: false, error: 'O nome do estabelecimento passa de 120 caracteres.' };
  const amount = typeof b.amount === 'string' ? Number(b.amount.replace(',', '.')) : Number(b.amount);
  if (!isValidMoney(amount)) return { ok: false, error: 'Informe o valor da nota: maior que zero, com até 2 casas decimais.' };
  const expenseDate = parseDateInput(b.expenseDate);
  if (!expenseDate) return { ok: false, error: 'Informe a data do gasto (dia real, no formato AAAA-MM-DD).' };
  if (expenseDate.getTime() > today.getTime()) return { ok: false, error: 'A data do gasto não pode ser futura.' };
  const chart = String(b.chartAccountId ?? '').trim();
  return { ok: true, value: { description, vendorName: vendor || null, amount: round2(amount), expenseDate, chartAccountId: chart || null } };
}

/** O pedido ainda pode ser editado (e ter anexos trocados) por quem o digitou. */
export const isEditable = (status: string) => status === 'draft' || status === 'returned';

/** Quem pode cancelar: o autor enquanto está com ele; a Tesouraria até a decisão do Venerável. */
export function canCancel(status: string, actor: { isAuthor: boolean; isTreasury: boolean }): boolean {
  if (isEditable(status) || status === 'submitted') return actor.isAuthor || actor.isTreasury;
  if (status === 'awaiting_vm') return actor.isTreasury;
  return false;
}

export interface SubmitContext {
  /** O pedido foi digitado pelo próprio irmão (portal) ou pela equipe em nome dele. */
  via: 'member' | 'staff';
  role: string | null | undefined;
  /** O autor é o próprio credor (ex.: Venerável pedindo reembolso de gasto dele). */
  authorIsCreditor: boolean;
}

export type SubmitTarget = { status: 'submitted' | 'awaiting_vm' | 'approved'; implicit: boolean };

/** Para onde o pedido vai quando é enviado. */
export function submitTarget(ctx: SubmitContext): SubmitTarget {
  if (ctx.via === 'member') return { status: 'submitted', implicit: false };
  const role = normalizeRole(ctx.role);
  // Venerável/Administrador digitando por outro irmão: a autorização já está implícita.
  if ((role === 'venerable' || role === 'admin') && !ctx.authorIsCreditor) return { status: 'approved', implicit: true };
  // Tesoureiro digitando: dispensa a própria conferência; quem decide é o Venerável.
  return { status: 'awaiting_vm', implicit: false };
}

/** Quem decide: Venerável/Administrador, e nunca o próprio beneficiário nem quem digitou o pedido. */
export function canDecide(actor: { role: string | null | undefined; userId: string; memberId: string | null }, r: { memberId: string; requestedByUserId: string }): { ok: true } | { ok: false; error: string } {
  const role = normalizeRole(actor.role);
  if (role !== 'venerable' && role !== 'admin') return { ok: false, error: 'Só o Venerável Mestre ou o Administrador decidem sobre reembolso.' };
  if ((actor.memberId && actor.memberId === r.memberId) || actor.userId === r.requestedByUserId) {
    return { ok: false, error: 'Quem pediu o reembolso não pode decidir sobre o próprio pedido: outro responsável (Administrador ou Venerável) precisa decidir.' };
  }
  return { ok: true };
}

export type AmountCheck = { ok: true; value: number } | { ok: false; error: string };

/** Valor autorizado: o da nota ou, com motivo registrado, um valor menor. */
export function checkApprovedAmount(requested: number, raw: unknown, note: string): AmountCheck {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: round2(requested) };
  const n = typeof raw === 'string' ? Number(raw.replace(',', '.')) : Number(raw);
  if (!isValidMoney(n)) return { ok: false, error: 'Valor autorizado inválido: maior que zero, com até 2 casas decimais.' };
  const value = round2(n);
  if (value > round2(requested)) return { ok: false, error: 'O valor autorizado não pode ser maior que o da nota.' };
  if (value < round2(requested) && note.trim().length < 3) return { ok: false, error: 'Para autorizar valor menor que o da nota, informe o motivo.' };
  return { ok: true, value };
}

/** Título da conta a pagar criada na autorização. */
export const reimbursementAccountTitle = (memberName: string, description: string) => `Reembolso — ${memberName} — ${description}`.slice(0, 200);

/** Marca na descrição da conta a pagar (para achar o pedido de volta a partir do lançamento). */
export const reimbursementMarker = (id: string) => `[reembolso:${id}]`;
export const reimbursementIdFromMarker = (text: string | null | undefined): string | null => /\[reembolso:([A-Za-z0-9_-]+)\]/.exec(text ?? '')?.[1] ?? null;

/** Pedidos que esperam ação de cada papel (alimenta o aviso numérico do menu). */
export function pendingForRole(role: string | null | undefined, counts: Partial<Record<ReimbursementStatus, number>>): number {
  const r = normalizeRole(role);
  const n = (s: ReimbursementStatus) => counts[s] ?? 0;
  if (r === 'admin') return n('submitted') + n('awaiting_vm') + n('approved');
  if (r === 'venerable') return n('awaiting_vm');
  if (r === 'treasurer') return n('submitted') + n('approved');
  return 0;
}
