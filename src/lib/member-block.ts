// Bloqueio do cadastro por comunicado à Potência + acordo de regularização — regras puras (sem banco).
//
// Três coisas distintas:
//  - Art. 002: enquadramento CALCULADO (mensalidade vencida há mais de 60 dias). Só informa; o irmão
//    segue ativo, convocado e recebendo cobrança. Nada é gravado no cadastro.
//  - Bloqueio: ato MANUAL do Venerável/Administrador, sobre irmão que já está no Art. 002, por já ter
//    comunicado a Potência. Member.status vira 'blocked': sem convocação, sem cobrança nova.
//  - Acordo: nasce no bloqueio. Reúne TODA dívida em aberto + a taxa de regularização (digitada) e,
//    se a loja quiser, multa/juros. Padrão à vista, sem desconto; até 3 parcelas. O irmão só volta
//    com tudo pago.

import { hasAtMostCents, remainingAmount, round2 } from './money';
import { ART_002_THRESHOLD_DAYS } from './overdue-rules';

export const BLOCKED_STATUS = 'blocked';
export const MAX_AGREEMENT_INSTALLMENTS = 3;

export type BlockStatus = 'open' | 'settled' | 'lifted';
export type ItemKind = 'debt' | 'fee' | 'extra';

export const BLOCKED_MESSAGE = 'Irmão bloqueado por comunicação à Potência. A regularização é feita pelo acordo, em Tesouraria → Acordos de regularização.';

export const isBlockedStatus = (status: string | null | undefined) => status === BLOCKED_STATUS;

/** Só o Venerável e o Administrador bloqueiam e levantam o bloqueio (ato de quem comunica a Potência). */
export function canBlockMembers(role: string | null | undefined): boolean {
  const r = (role ?? '').toLowerCase().trim();
  return r === 'admin' || r === 'venerable';
}

export type BlockCheck = { ok: true } | { ok: false; error: string };

/** Pode bloquear? Só irmão ATIVO que já está enquadrado no Art. 002 (e ainda não bloqueado). */
export function checkCanBlock(member: { status: string }, daysOverdue: number | null, art002Enabled: boolean): BlockCheck {
  if (isBlockedStatus(member.status)) return { ok: false, error: 'Este irmão já está bloqueado.' };
  if (member.status !== 'active') return { ok: false, error: 'Só é possível bloquear um irmão com situação "Ativo".' };
  if (!art002Enabled) return { ok: false, error: 'O Art. 002 está desligado nas Configurações desta loja.' };
  if (daysOverdue == null || daysOverdue <= ART_002_THRESHOLD_DAYS) {
    return { ok: false, error: `O irmão ainda não está enquadrado no Art. 002 (mensalidade vencida há mais de ${ART_002_THRESHOLD_DAYS} dias).` };
  }
  return { ok: true };
}

// ── Pacote do acordo ──────────────────────────────────────────────────────────

export interface DebtInput {
  accountId: string;
  title: string;
  amount: number;
  paid: number;
  dueDate: Date;
}

export interface PackageItemDraft {
  accountId: string | null; // null = a Account ainda será criada (taxa / multa-juros)
  kind: ItemKind;
  title: string;
  openAmount: number;
  sortOrder: number;
}

/** Saldo em aberto de uma dívida (valor − pagamentos já feitos); nunca negativo. */
export const debtBalance = (amount: number, paid: number) => remainingAmount(Number(amount), Number(paid));

/**
 * Monta o pacote: a taxa de regularização primeiro (é o que libera junto à Potência), depois a
 * multa/juros opcional, depois as dívidas do vencimento mais antigo para o mais novo. A ordem
 * (sortOrder) é a mesma em que um pagamento parcelado é apropriado.
 */
export function buildPackage(
  debts: DebtInput[],
  fee: number,
  extra: number,
): { items: PackageItemDraft[]; debtsTotal: number; total: number } {
  const items: PackageItemDraft[] = [];
  let order = 0;
  if (fee > 0) items.push({ accountId: null, kind: 'fee', title: 'Taxa de regularização — Art. 002', openAmount: round2(fee), sortOrder: order++ });
  if (extra > 0) items.push({ accountId: null, kind: 'extra', title: 'Multa e juros do acordo de regularização', openAmount: round2(extra), sortOrder: order++ });
  const open = debts
    .map((d) => ({ d, balance: debtBalance(d.amount, d.paid) }))
    .filter((x) => x.balance > 0)
    .sort((a, b) => a.d.dueDate.getTime() - b.d.dueDate.getTime() || a.d.title.localeCompare(b.d.title));
  let debtsTotal = 0;
  for (const { d, balance } of open) {
    debtsTotal = round2(debtsTotal + balance);
    items.push({ accountId: d.accountId, kind: 'debt', title: d.title, openAmount: balance, sortOrder: order++ });
  }
  return { items, debtsTotal, total: round2(debtsTotal + round2(fee) + round2(extra)) };
}

export interface BlockInput {
  fee: number;
  extra: number;
  installments: number;
  firstDueDate: Date;
}

/** Valida e normaliza o que o Venerável digitou. `total` é o que sobra depois das dívidas. */
export function parseBlockInput(
  raw: { fee?: unknown; extra?: unknown; installments?: unknown; firstDueDate?: unknown },
  today: Date,
): { ok: true; value: BlockInput } | { ok: false; error: string } {
  const fee = raw.fee === '' || raw.fee == null ? NaN : Number(raw.fee);
  if (!Number.isFinite(fee) || fee < 0 || !hasAtMostCents(fee)) {
    return { ok: false, error: 'Informe a taxa de regularização (use 0 se não houver), com até 2 casas decimais.' };
  }
  const extraRaw = raw.extra === '' || raw.extra == null ? 0 : Number(raw.extra);
  if (!Number.isFinite(extraRaw) || extraRaw < 0 || !hasAtMostCents(extraRaw)) {
    return { ok: false, error: 'Multa e juros: informe um valor válido, com até 2 casas decimais (ou deixe em branco).' };
  }
  const installments = raw.installments == null || raw.installments === '' ? 1 : Number(raw.installments);
  if (!Number.isInteger(installments) || installments < 1 || installments > MAX_AGREEMENT_INSTALLMENTS) {
    return { ok: false, error: `O acordo pode ter de 1 (à vista) a ${MAX_AGREEMENT_INSTALLMENTS} parcelas.` };
  }
  let firstDueDate = today;
  if (raw.firstDueDate != null && raw.firstDueDate !== '') {
    const parsed = typeof raw.firstDueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.firstDueDate) ? new Date(`${raw.firstDueDate}T00:00:00Z`) : new Date(NaN);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: 'Vencimento da 1ª parcela inválido.' };
    if (parsed.getTime() < today.getTime()) return { ok: false, error: 'O vencimento da 1ª parcela não pode ser anterior a hoje.' };
    firstDueDate = parsed;
  }
  return { ok: true, value: { fee: round2(fee), extra: round2(extraRaw), installments, firstDueDate } };
}

// ── Parcelas ──────────────────────────────────────────────────────────────────

export interface Installment {
  number: number;
  dueDate: Date;
  amount: number;
}

/** Parcelas iguais em centavos (a sobra vai para a última), vencendo de mês em mês. */
export function buildInstallments(total: number, count: number, firstDueDate: Date): Installment[] {
  const n = Math.max(1, Math.floor(count));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const out: Installment[] = [];
  let due = firstDueDate;
  for (let i = 0; i < n; i++) {
    const c = i === n - 1 ? cents - base * (n - 1) : base;
    out.push({ number: i + 1, dueDate: due, amount: c / 100 });
    due = addMonths(firstDueDate, i + 1);
  }
  return out;
}

/** Soma meses a uma data-só-dia preservando o dia (sem estourar o fim do mês). */
function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

export interface InstallmentState extends Installment {
  covered: boolean; // o que já foi pago cobre esta parcela (e as anteriores)
  late: boolean;    // venceu e não está coberta
}

/** Situação de cada parcela dado o total já pago do acordo (o pagamento cobre as parcelas em ordem). */
export function installmentStates(installments: Installment[], paidTotal: number, today: Date): InstallmentState[] {
  let cumulative = 0;
  return installments.map((i) => {
    cumulative = round2(cumulative + i.amount);
    const covered = paidTotal + 0.005 >= cumulative;
    return { ...i, covered, late: !covered && i.dueDate.getTime() < today.getTime() };
  });
}

// ── Apropriação de um pagamento do acordo ─────────────────────────────────────

export interface AllocatableItem {
  itemId: string;
  accountId: string;
  remaining: number;
  sortOrder: number;
}

/** Reparte um pagamento entre os itens, na ordem do pacote (taxa primeiro, depois a dívida mais antiga). */
export function allocatePayment(items: AllocatableItem[], amount: number): { allocations: { itemId: string; accountId: string; amount: number }[]; leftover: number } {
  let left = round2(amount);
  const allocations: { itemId: string; accountId: string; amount: number }[] = [];
  for (const item of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (left <= 0) break;
    if (item.remaining <= 0) continue;
    const part = round2(Math.min(item.remaining, left));
    allocations.push({ itemId: item.itemId, accountId: item.accountId, amount: part });
    left = round2(left - part);
  }
  return { allocations, leftover: left };
}

/** Quanto do pacote já foi pago: soma de (saldo na hora do bloqueio − saldo de agora) por item. */
export function paidSoFar(items: { openAmount: number; remaining: number }[]): number {
  return round2(items.reduce((sum, i) => sum + Math.max(0, Math.min(i.openAmount, i.openAmount - i.remaining)), 0));
}
