import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { findFundChart, fundChartWhere, resolveBankAccount } from '@/lib/funds';
import { ASAAS_FEE_CHART } from '@/lib/collection';
import { isValidMoney } from '@/lib/money';
import { findClosedTermForDate } from '@/lib/term-lock';
import {
  canConfirmTronco, canDeclareTronco, generateTroncoCode, summarizeBySession,
  type TroncoChannel, type TroncoSessionRow, type TroncoSource,
} from '@/lib/tronco-session';

type Db = Prisma.TransactionClient;
type Fail = { ok: false; status: number; error: string };

export interface TroncoUser { id: string; name: string; role: string | null | undefined }

export interface RecordTroncoInput {
  lodgeId: string;
  user: TroncoUser;
  amount: number;
  /** Data do recebimento (só dia, 00:00 UTC). */
  date: Date;
  paidAt: Date;
  method: 'cash' | 'pix' | 'transfer' | 'other';
  channel?: TroncoChannel;
  source: TroncoSource;
  sessionId: string | null;
  bankAccountId: string | null;
  note: string | null;
  externalRef?: string | null;
}

const METHOD_LABEL: Record<string, string> = { cash: 'Dinheiro', pix: 'Pix', transfer: 'Transferência', other: 'Outro' };

/** Lança no caixa: Account (já paga) + Payment na categoria do Tronco, no banco/caixa informado. Sem doador. */
async function postToCashbox(
  db: Db,
  p: { lodgeId: string; amount: number; date: Date; paidAt: Date; method: string; sessionId: string | null; bankAccountId: string | null; note: string | null; code: string },
): Promise<{ ok: true; paymentId: string; bankId: string } | Fail> {
  const locked = await findClosedTermForDate(db, p.lodgeId, p.date);
  if (locked) return { ok: false, status: 409, error: `Período encerrado (${locked.title}). Não é possível lançar com data dentro de um veneralato já fechado.` };
  const chart = await findFundChart(db, p.lodgeId, 'tronco', 'REVENUE');
  if (!chart) return { ok: false, status: 400, error: 'Categoria do Tronco não encontrada: use "Atualizar plano de contas" em Cadastros.' };
  const bank = await resolveBankAccount(db, p.lodgeId, p.bankAccountId);
  if (bank.invalid) return { ok: false, status: 400, error: 'Conta bancária/caixa inválida ou inativa.' };
  if (!bank.id) return { ok: false, status: 400, error: 'Informe em qual conta ou caixa da loja o dinheiro entrou.' };
  const detail = [METHOD_LABEL[p.method], p.note, `DNA ${p.code}`].filter(Boolean).join(' · ');
  const account = await db.account.create({
    data: {
      lodgeId: p.lodgeId, type: 'RECEIVABLE', title: 'Aporte — Tronco de Beneficência', amount: p.amount, dueDate: p.date, status: 'paid',
      chartAccountId: chart.id, bankAccountId: bank.id, sessionId: p.sessionId, description: p.sessionId ? 'Tronco passado em sessão' : 'Doador não identificado',
    },
    select: { id: true },
  });
  const payment = await db.payment.create({
    data: { lodgeId: p.lodgeId, accountId: account.id, memberId: null, bankAccountId: bank.id, amount: p.amount, paidAt: p.paidAt, method: 'donation', note: detail },
    select: { id: true },
  });
  return { ok: true, paymentId: payment.id, bankId: bank.id };
}

/** Tarifa real cobrada pelo Asaas sobre o Pix do QR: despesa na mesma conta (como nas cobranças), absorvida pela loja. */
async function postAsaasFee(db: Db, lodgeId: string, fee: number, bankId: string, date: Date, code: string): Promise<void> {
  const chart = (await db.chartAccount.findFirst({ where: { lodgeId, code: ASAAS_FEE_CHART.code }, select: { id: true } })) ?? (await db.chartAccount.create({ data: { lodgeId, ...ASAAS_FEE_CHART }, select: { id: true } }));
  const account = await db.account.create({
    data: { lodgeId, type: 'PAYABLE', title: `Tarifa Asaas — Tronco ${code}`, amount: fee, dueDate: date, status: 'paid', chartAccountId: chart.id, bankAccountId: bankId, counterpartyName: 'Asaas', description: `Tarifa do Asaas sobre o Pix do QR da sessão (${code}), absorvida pela loja` },
    select: { id: true },
  });
  await db.payment.create({ data: { lodgeId, accountId: account.id, bankAccountId: bankId, amount: fee, method: 'asaas-fee', paidAt: date, note: `Tarifa Asaas (${code})` } });
}

/**
 * Declara uma entrada do Tronco. Tesoureiro, Venerável e Administrador: já é lançada no caixa (confirmada). Hospitaleiro: fica
 * aguardando a confirmação de um deles. Os demais cargos (inclusive o Secretário) não declaram.
 */
export async function recordTronco(db: Db, input: RecordTroncoInput): Promise<{ ok: true; intakeId: string; code: string; status: 'confirmed' | 'pending'; paymentId: string | null } | Fail> {
  const { lodgeId, user } = input;
  if (!canDeclareTronco(user.role)) return { ok: false, status: 403, error: 'Só o Tesoureiro, o Venerável, o Administrador e o Hospitaleiro registram o Tronco.' };
  if (!isValidMoney(input.amount)) return { ok: false, status: 400, error: 'Informe um valor maior que zero, com até 2 casas decimais.' };
  if (input.sessionId) {
    const s = await db.session.findFirst({ where: { id: input.sessionId, lodgeId }, select: { id: true } });
    if (!s) return { ok: false, status: 404, error: 'Sessão não encontrada.' };
  }
  const code = generateTroncoCode();
  const confirm = canConfirmTronco(user.role);
  let paymentId: string | null = null;
  if (confirm) {
    const posted = await postToCashbox(db, { lodgeId, amount: input.amount, date: input.date, paidAt: input.paidAt, method: input.method, sessionId: input.sessionId, bankAccountId: input.bankAccountId, note: input.note, code });
    if (!posted.ok) return posted;
    paymentId = posted.paymentId;
  }
  const intake = await db.troncoIntake.create({
    data: {
      lodgeId, sessionId: input.sessionId, source: input.source, channel: input.channel ?? (input.method === 'cash' ? 'cash' : input.method === 'pix' ? 'pix' : 'other'),
      amount: input.amount, status: confirm ? 'confirmed' : 'pending', code, externalRef: input.externalRef ?? null, note: input.note,
      declaredById: user.id, declaredByName: user.name, confirmedById: confirm ? user.id : null, confirmedAt: confirm ? new Date() : null, paymentId,
    },
    select: { id: true },
  });
  await logAudit(db, { lodgeId, userId: user.id, action: 'CREATE', entity: 'tronco-intake', entityId: intake.id, metadata: { code, amount: input.amount, status: confirm ? 'confirmed' : 'pending', sessionId: input.sessionId, source: input.source } });
  return { ok: true, intakeId: intake.id, code, status: confirm ? 'confirmed' : 'pending', paymentId };
}

/** Lança no caixa uma entrada que estava aguardando (declarada pelo Hospitaleiro ou vinda do QR da sessão). */
export async function confirmTronco(
  db: Db, lodgeId: string, intakeId: string, user: TroncoUser, input: { bankAccountId: string | null; date: Date; paidAt: Date },
): Promise<{ ok: true; paymentId: string } | Fail> {
  if (!canConfirmTronco(user.role)) return { ok: false, status: 403, error: 'Só o Tesoureiro, o Venerável e o Administrador confirmam entradas do Tronco.' };
  const intake = await db.troncoIntake.findFirst({ where: { id: intakeId, lodgeId } });
  if (!intake) return { ok: false, status: 404, error: 'Entrada não encontrada.' };
  if (intake.status !== 'pending') return { ok: false, status: 409, error: intake.status === 'confirmed' ? 'Esta entrada já foi lançada no caixa.' : 'Esta entrada foi recusada.' };
  const method = intake.channel === 'cash' ? 'cash' : intake.channel.startsWith('pix') ? 'pix' : 'other';
  // Pix do QR da sessão: o dinheiro está no Asaas; sem conta escolhida, vai para a conta de repasse da loja.
  let bankAccountId = input.bankAccountId;
  if (!bankAccountId && intake.channel === 'pix_qr') {
    const lodge = await db.lodge.findUnique({ where: { id: lodgeId }, select: { asaasSettlementAccountId: true } });
    bankAccountId = lodge?.asaasSettlementAccountId ?? null;
  }
  const posted = await postToCashbox(db, { lodgeId, amount: Number(intake.amount), date: input.date, paidAt: input.paidAt, method, sessionId: intake.sessionId, bankAccountId, note: intake.note, code: intake.code });
  if (!posted.ok) return posted;
  if (intake.fee && intake.fee > 0) await postAsaasFee(db, lodgeId, Number(intake.fee), posted.bankId, input.date, intake.code);
  await db.troncoIntake.update({ where: { id: intake.id }, data: { status: 'confirmed', confirmedById: user.id, confirmedAt: new Date(), paymentId: posted.paymentId } });
  await logAudit(db, { lodgeId, userId: user.id, action: 'UPDATE', entity: 'tronco-intake', entityId: intake.id, metadata: { code: intake.code, confirmed: true, amount: Number(intake.amount) } });
  return { ok: true, paymentId: posted.paymentId };
}

export async function rejectTronco(db: Db, lodgeId: string, intakeId: string, user: TroncoUser, reason: string): Promise<{ ok: true } | Fail> {
  if (!canConfirmTronco(user.role)) return { ok: false, status: 403, error: 'Só o Tesoureiro, o Venerável e o Administrador recusam entradas do Tronco.' };
  if (!reason.trim()) return { ok: false, status: 400, error: 'Informe o motivo da recusa.' };
  const intake = await db.troncoIntake.findFirst({ where: { id: intakeId, lodgeId }, select: { id: true, status: true, code: true } });
  if (!intake) return { ok: false, status: 404, error: 'Entrada não encontrada.' };
  if (intake.status !== 'pending') return { ok: false, status: 409, error: 'Só entradas aguardando podem ser recusadas.' };
  await db.troncoIntake.update({ where: { id: intake.id }, data: { status: 'rejected', rejectReason: reason.trim().slice(0, 300), confirmedById: user.id, confirmedAt: new Date() } });
  await logAudit(db, { lodgeId, userId: user.id, action: 'UPDATE', entity: 'tronco-intake', entityId: intake.id, metadata: { code: intake.code, rejected: true, reason: reason.trim().slice(0, 300) } });
  return { ok: true };
}

export interface TroncoSessionTotals extends TroncoSessionRow { title: string | null; date: Date | null }

/**
 * Totais do Tronco por sessão (sem doador): o confirmado (pagamentos na categoria do Tronco ligados à sessão), o aguardando
 * (entradas declaradas ainda não lançadas) e a divisão por origem do confirmado. Visível a todos os cargos.
 */
export async function loadTroncoBySession(db: Db, lodgeId: string, opts: { sessionIds?: string[]; limit?: number } = {}): Promise<TroncoSessionTotals[]> {
  const sessionFilter = opts.sessionIds ? { in: opts.sessionIds } : { not: null };
  const [payments, intakes] = await Promise.all([
    db.payment.findMany({
      where: { lodgeId, account: { type: 'RECEIVABLE', sessionId: sessionFilter, chartAccount: fundChartWhere('tronco') } },
      select: { id: true, amount: true, account: { select: { sessionId: true } } },
    }),
    db.troncoIntake.findMany({ where: { lodgeId, ...(opts.sessionIds ? { sessionId: { in: opts.sessionIds } } : {}), status: { in: ['pending', 'confirmed'] } }, select: { status: true, amount: true, source: true, sessionId: true, paymentId: true } }),
  ]);
  const sourceByPayment = new Map(intakes.filter((i) => i.paymentId).map((i) => [i.paymentId!, i.source as TroncoSource]));
  const rows = summarizeBySession([
    ...payments.map((p) => ({ sessionId: p.account?.sessionId ?? null, amount: Number(p.amount), status: 'confirmed', source: sourceByPayment.get(p.id) ?? null })),
    ...intakes.filter((i) => i.status === 'pending').map((i) => ({ sessionId: i.sessionId, amount: Number(i.amount), status: 'pending', source: i.source as TroncoSource })),
  ]).filter((r) => r.sessionId);
  const ids = rows.map((r) => r.sessionId!) ;
  const sessions = ids.length ? await db.session.findMany({ where: { lodgeId, id: { in: ids } }, select: { id: true, title: true, date: true } }) : [];
  const info = new Map(sessions.map((s) => [s.id, s]));
  return rows
    .map((r) => ({ ...r, title: info.get(r.sessionId!)?.title ?? null, date: info.get(r.sessionId!)?.date ?? null }))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .slice(0, opts.limit ?? 50);
}
