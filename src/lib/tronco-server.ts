import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { findFundChart, fundChartWhere, resolveBankAccount } from '@/lib/funds';
import { ASAAS_FEE_CHART } from '@/lib/collection';
import { dateOnlyUTC, todayBR } from '@/lib/date-only';
import { identifierInText } from '@/lib/tronco-loja-pix';
import { isValidMoney } from '@/lib/money';
import { findClosedTermForDate } from '@/lib/term-lock';
import { checkLedgerOpen } from '@/lib/ledger-lock-server';
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
  const ledger = await checkLedgerOpen(db, p.lodgeId, [p.date, p.paidAt], { what: 'tronco.post' });
  if (!ledger.ok) return { ok: false, status: 409, error: ledger.error };
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

export interface StatementMatch { sessionId: string; source: 'members' | 'visitors'; identifier: string; total: number; count: number; ids: string[] }

/**
 * Créditos do extrato (OFX importado, ainda sem conciliar) que trazem o identificador de uma sessão (txid do QR da loja) na
 * descrição — o que o Tesoureiro monitora no Modo Loja. Só vale se o banco da loja devolve o identificador no extrato.
 */
export async function findStatementMatches(db: Db, lodgeId: string, sessionIds: string[]): Promise<StatementMatch[]> {
  if (sessionIds.length === 0) return [];
  const qrs = await db.troncoSessionQr.findMany({ where: { lodgeId, sessionId: { in: sessionIds }, provider: 'lodge', identifier: { not: null } }, select: { sessionId: true, source: true, identifier: true } });
  if (qrs.length === 0) return [];
  const credits = await db.bankTransaction.findMany({ where: { lodgeId, status: 'unmatched', amount: { gt: 0 } }, select: { id: true, amount: true, description: true } });
  const out: StatementMatch[] = [];
  for (const q of qrs) {
    const hit = credits.filter((c) => identifierInText(c.description, q.identifier!));
    if (hit.length === 0) continue;
    out.push({ sessionId: q.sessionId, source: q.source as 'members' | 'visitors', identifier: q.identifier!, total: Math.round(hit.reduce((sum, c) => sum + Math.round(Number(c.amount) * 100), 0)) / 100, count: hit.length, ids: hit.map((c) => c.id) });
  }
  return out;
}

/**
 * "Lançar do extrato": soma os créditos do extrato com o identificador da sessão e lança no caixa do Tronco (confirmado, ligado à
 * sessão e à origem), conciliando as linhas do extrato com o lançamento. Só quem confirma o Tronco.
 */
export async function postStatementCredits(
  db: Db, lodgeId: string, user: TroncoUser, input: { sessionId: string; source: 'members' | 'visitors'; bankAccountId: string | null },
): Promise<{ ok: true; total: number; count: number; paymentId: string } | Fail> {
  if (!canConfirmTronco(user.role)) return { ok: false, status: 403, error: 'Só o Tesoureiro, o Venerável e o Administrador lançam o Tronco.' };
  const matches = await findStatementMatches(db, lodgeId, [input.sessionId]);
  const m = matches.find((x) => x.source === input.source);
  if (!m) return { ok: false, status: 404, error: 'Nenhum crédito sem conciliar com o identificador desta sessão. Importe o extrato em Conciliação bancária.' };
  const txs = await db.bankTransaction.findMany({ where: { id: { in: m.ids }, lodgeId, status: 'unmatched' }, select: { id: true, date: true } });
  const last = txs.reduce((a, b) => (a > b.date ? a : b.date), txs[0].date);
  const date = dateOnlyUTC(last);
  if (date.getTime() > todayBR().getTime()) return { ok: false, status: 400, error: 'Há crédito com data futura no extrato.' };
  const paidAt = date; // dia contábil (só dia), como toda baixa digitada
  const rec = await recordTronco(db, {
    lodgeId, user, amount: m.total, date, paidAt, method: 'pix', channel: 'pix', source: input.source, sessionId: input.sessionId,
    bankAccountId: input.bankAccountId, note: `Extrato: ${m.count} crédito(s) com o identificador ${m.identifier}`,
  });
  if (!rec.ok) return rec;
  if (rec.paymentId) await db.bankTransaction.updateMany({ where: { id: { in: txs.map((t) => t.id) }, lodgeId, status: 'unmatched' }, data: { status: 'matched', matchedPaymentId: rec.paymentId } });
  return { ok: true, total: m.total, count: m.count, paymentId: rec.paymentId! };
}

export interface UnassignedTronco { paymentId: string; amount: number; paidAt: Date; bankName: string | null; method: string; note: string | null; source: TroncoSource | null }

/** Entradas do Tronco já lançadas no caixa que não estão ligadas a nenhuma sessão (extrato, Pagamentos, aporte avulso…). */
export async function loadUnassignedTronco(db: Db, lodgeId: string): Promise<UnassignedTronco[]> {
  const payments = await db.payment.findMany({
    where: { lodgeId, account: { type: 'RECEIVABLE', sessionId: null, chartAccount: fundChartWhere('tronco') } },
    select: { id: true, amount: true, paidAt: true, method: true, note: true, bankAccount: { select: { name: true } } },
    orderBy: { paidAt: 'desc' },
    take: 100,
  });
  if (payments.length === 0) return [];
  const ids = payments.map((p) => p.id);
  const [intakes, donations] = await Promise.all([
    db.troncoIntake.findMany({ where: { lodgeId, paymentId: { in: ids } }, select: { paymentId: true, source: true } }),
    db.campaignDonation.findMany({ where: { lodgeId, paymentId: { in: ids } }, select: { paymentId: true } }),
  ]);
  const inCampaign = new Set(donations.map((d) => d.paymentId));
  const src = new Map(intakes.map((i) => [i.paymentId, i.source as TroncoSource]));
  return payments
    .filter((p) => !inCampaign.has(p.id))
    .map((p) => ({ paymentId: p.id, amount: Number(p.amount), paidAt: p.paidAt, bankName: p.bankAccount?.name ?? null, method: p.method, note: p.note, source: src.get(p.id) ?? null }));
}

/**
 * Liga uma entrada do Tronco já lançada a uma sessão (ou troca/solta a sessão) e guarda a origem do dinheiro. Não mexe em valor,
 * data nem conta: o saldo e o extrato do banco ficam como estão. Só quem confirma o Tronco.
 */
export async function assignTroncoToSession(
  db: Db, lodgeId: string, user: TroncoUser, input: { paymentId: string; sessionId: string | null; source: TroncoSource },
): Promise<{ ok: true } | Fail> {
  if (!canConfirmTronco(user.role)) return { ok: false, status: 403, error: 'Só o Tesoureiro, o Venerável e o Administrador atribuem o Tronco a uma sessão.' };
  const payment = await db.payment.findFirst({
    where: { id: input.paymentId, lodgeId, account: { type: 'RECEIVABLE', chartAccount: fundChartWhere('tronco') } },
    select: { id: true, amount: true, method: true, accountId: true, account: { select: { sessionId: true } } },
  });
  if (!payment || !payment.accountId) return { ok: false, status: 404, error: 'Entrada do Tronco não encontrada.' };
  if (await db.campaignDonation.findFirst({ where: { lodgeId, paymentId: payment.id }, select: { id: true } })) return { ok: false, status: 409, error: 'Esta entrada é doação de uma campanha, não do Tronco de sessão.' };
  if (input.sessionId) {
    const s = await db.session.findFirst({ where: { id: input.sessionId, lodgeId }, select: { id: true } });
    if (!s) return { ok: false, status: 404, error: 'Sessão não encontrada.' };
  }
  const previous = payment.account?.sessionId ?? null;
  await db.account.update({ where: { id: payment.accountId }, data: { sessionId: input.sessionId, description: input.sessionId ? 'Tronco passado em sessão' : 'Doador não identificado' } });
  const intake = await db.troncoIntake.findFirst({ where: { lodgeId, paymentId: payment.id }, select: { id: true } });
  if (intake) {
    await db.troncoIntake.update({ where: { id: intake.id }, data: { sessionId: input.sessionId, source: input.source } });
  } else {
    await db.troncoIntake.create({
      data: {
        lodgeId, sessionId: input.sessionId, source: input.source, channel: payment.method === 'cash' ? 'cash' : payment.method === 'pix' ? 'pix' : 'other',
        amount: payment.amount, status: 'confirmed', code: generateTroncoCode(), note: 'Atribuída à sessão depois do lançamento',
        declaredById: user.id, declaredByName: user.name, confirmedById: user.id, confirmedAt: new Date(), paymentId: payment.id,
      },
    });
  }
  await logAudit(db, { lodgeId, userId: user.id, action: 'UPDATE', entity: 'tronco-assign', entityId: payment.id, metadata: { from: previous, to: input.sessionId, source: input.source, amount: Number(payment.amount) } });
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
