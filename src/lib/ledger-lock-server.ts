// Conferência do livro com o banco — parte com banco de dados. Regras puras em lib/ledger-lock.ts.
// Sem logAudit de propósito (arrasta next-auth e quebra teste com banco falso): a trilha é gravada direto
// no AuditLog, no mesmo padrão do member-block-sync.
import type { Prisma } from '@/generated/prisma/client';
import { dayKeyToDate, isDayKey, ledgerDayKey, ledgerQueryWindow, todayKeyBR } from '@/lib/ledger-day';
import {
  checkDecision, compareBalances, isLockedDay, lockedMessage, parseCheckpointBalances, rectificationCovers, RECTIFICATION_TTL_MS,
  type BalanceMismatch, type CheckpointBalance,
} from '@/lib/ledger-lock';
import { round2 } from '@/lib/money';

type Db = Prisma.TransactionClient;

async function audit(db: Db, p: { lodgeId: string; userId?: string | null; action: 'CREATE' | 'UPDATE' | 'DELETE'; entity: string; entityId: string; detail: Record<string, unknown> }) {
  try {
    await db.auditLog.create({
      data: { lodgeId: p.lodgeId, userId: p.userId && !p.userId.startsWith('system:') ? p.userId : null, action: p.action, entity: p.entity, entityId: p.entityId, after: JSON.stringify(p.detail) },
    });
  } catch {
    // auditoria nunca derruba a operação
  }
}

export interface ActiveCheckpoint {
  id: string;
  throughKey: string;
  balances: CheckpointBalance[];
  confirmedByName: string;
  createdAt: Date;
}

/** A conferência vigente: a de maior data entre as não desfeitas (a mais recente em caso de empate). */
export async function getActiveCheckpoint(db: Db, lodgeId: string): Promise<ActiveCheckpoint | null> {
  const row = await db.ledgerCheckpoint.findFirst({ where: { lodgeId, undoneAt: null }, orderBy: [{ throughDate: 'desc' }, { createdAt: 'desc' }] });
  if (!row) return null;
  return { id: row.id, throughKey: row.throughDate.toISOString().slice(0, 10), balances: parseCheckpointBalances(row.balancesJson), confirmedByName: row.confirmedByName, createdAt: row.createdAt };
}

export type LedgerGate = { ok: true; rectificationIds: string[] } | { ok: false; error: string; throughKey: string };

/**
 * Porta única das operações que mexem no caixa (pagamento, transferência, saldo de abertura): se alguma das
 * datas cai no período já conferido com o banco, só passa com uma retificação APROVADA, vigente e que cubra
 * o dia. Usada ao lado de findClosedTermForDate (que cuida do veneralato encerrado).
 */
export async function checkLedgerOpen(
  db: Db,
  lodgeId: string,
  dates: (Date | string | null | undefined)[],
  ctx: { userId?: string | null; what?: string; now?: Date; /** só confere, sem contar o uso da retificação */ dryRun?: boolean } = {},
): Promise<LedgerGate> {
  const checkpoint = await getActiveCheckpoint(db, lodgeId);
  if (!checkpoint) return { ok: true, rectificationIds: [] };
  const days = [...new Set(dates.filter((d): d is Date | string => d != null && d !== '').map((d) => (typeof d === 'string' && isDayKey(d) ? d : ledgerDayKey(d))))];
  const locked = days.filter((d) => isLockedDay(d, checkpoint.throughKey));
  if (locked.length === 0) return { ok: true, rectificationIds: [] };

  const now = ctx.now ?? new Date();
  const rows = await db.ledgerRectification.findMany({ where: { lodgeId, status: 'approved', closedAt: null } });
  const rects = rows.map((r) => ({ id: r.id, status: r.status, dateFrom: r.dateFrom.toISOString().slice(0, 10), dateTo: r.dateTo.toISOString().slice(0, 10), expiresAt: r.expiresAt, closedAt: r.closedAt }));
  const used = new Set<string>();
  for (const day of locked) {
    const cover = rects.find((r) => rectificationCovers(r, day, now));
    if (!cover) return { ok: false, error: lockedMessage(checkpoint.throughKey), throughKey: checkpoint.throughKey };
    used.add(cover.id);
  }
  if (ctx.dryRun) return { ok: true, rectificationIds: [...used] };
  for (const id of used) {
    await db.ledgerRectification.update({ where: { id }, data: { usedCount: { increment: 1 }, lastUsedAt: now } });
    await audit(db, { lodgeId, userId: ctx.userId, action: 'UPDATE', entity: 'ledger-rectification-use', entityId: id, detail: { what: ctx.what ?? null, days: locked } });
  }
  return { ok: true, rectificationIds: [...used] };
}

/** Saldo calculado de cada conta financeira ao fim do dia `throughKey` (abertura + pagamentos + transferências aprovadas). */
export async function balancesAsOf(db: Db, lodgeId: string, throughKey: string): Promise<{ accountId: string; name: string; active: boolean; calculated: number }[]> {
  const window = ledgerQueryWindow('2000-01-01', throughKey);
  const [accounts, payments, transfers] = await Promise.all([
    db.financialAccount.findMany({ where: { lodgeId }, select: { id: true, name: true, active: true, openingBalance: true }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    db.payment.findMany({ where: { lodgeId, bankAccountId: { not: null }, paidAt: { lte: window.lte } }, select: { bankAccountId: true, amount: true, paidAt: true, account: { select: { type: true } } } }),
    db.accountTransfer.findMany({ where: { lodgeId, status: 'approved', date: { lte: window.lte } }, select: { fromId: true, toId: true, amount: true, date: true } }),
  ]);
  const saldo = new Map<string, number>(accounts.map((a) => [a.id, a.openingBalance]));
  for (const p of payments) {
    if (!p.bankAccountId || !saldo.has(p.bankAccountId) || ledgerDayKey(p.paidAt) > throughKey) continue;
    saldo.set(p.bankAccountId, round2((saldo.get(p.bankAccountId) ?? 0) + (p.account?.type === 'RECEIVABLE' ? 1 : -1) * Number(p.amount)));
  }
  for (const t of transfers) {
    if (ledgerDayKey(t.date) > throughKey) continue;
    if (saldo.has(t.fromId)) saldo.set(t.fromId, round2((saldo.get(t.fromId) ?? 0) - Number(t.amount)));
    if (saldo.has(t.toId)) saldo.set(t.toId, round2((saldo.get(t.toId) ?? 0) + Number(t.amount)));
  }
  return accounts.map((a) => ({ accountId: a.id, name: a.name, active: a.active, calculated: round2(saldo.get(a.id) ?? 0) }));
}

export type ConfirmResult =
  | { ok: true; id: string; throughKey: string }
  | { ok: false; error: string; mismatches?: BalanceMismatch[] };

/**
 * Registra "conferido até <dia>": o Tesoureiro informa o saldo do BANCO de cada conta e o sistema só aceita se
 * bater, ao centavo, com o que ele calcula. Conta inativa sem saldo nem movimento não precisa ser informada.
 */
export async function confirmCheckpoint(
  db: Db,
  p: { lodgeId: string; throughKey: string; informed: Record<string, number>; user: { id: string; name: string }; note?: string | null; now?: Date },
): Promise<ConfirmResult> {
  const today = todayKeyBR(p.now);
  if (!isDayKey(p.throughKey)) return { ok: false, error: 'Informe o dia até o qual o livro foi conferido.' };
  if (p.throughKey >= today) return { ok: false, error: 'Só se confere um dia já encerrado: escolha uma data anterior a hoje.' };
  const current = await getActiveCheckpoint(db, p.lodgeId);
  if (current && p.throughKey < current.throughKey) {
    return { ok: false, error: `O livro já está conferido até ${current.throughKey.split('-').reverse().join('/')}. Para voltar atrás, o Venerável Mestre desfaz a conferência atual.` };
  }
  const calc = await balancesAsOf(db, p.lodgeId, p.throughKey);
  const rows: { accountId: string; name: string; informed: number; calculated: number }[] = [];
  for (const a of calc) {
    const given = p.informed[a.accountId];
    if (given === undefined || given === null || Number.isNaN(Number(given))) {
      if (!a.active && a.calculated === 0) continue;
      return { ok: false, error: `Informe o saldo do banco da conta "${a.name}".` };
    }
    rows.push({ accountId: a.accountId, name: a.name, informed: round2(Number(given)), calculated: a.calculated });
  }
  if (rows.length === 0) return { ok: false, error: 'Cadastre uma conta bancária ou Caixa antes de conferir o livro.' };
  const mismatches = compareBalances(rows);
  if (mismatches.length > 0) return { ok: false, error: 'O saldo informado não bate com o do sistema nesta data. Confira os lançamentos até esse dia antes de travar o livro.', mismatches };

  const created = await db.ledgerCheckpoint.create({
    data: { lodgeId: p.lodgeId, throughDate: dayKeyToDate(p.throughKey), balancesJson: JSON.stringify(rows), confirmedById: p.user.id, confirmedByName: p.user.name, note: p.note?.trim() || null },
    select: { id: true },
  });
  // Retificação em andamento termina com a reconferência: a janela se fecha e o livro volta a ficar travado.
  await db.ledgerRectification.updateMany({ where: { lodgeId: p.lodgeId, status: 'approved', closedAt: null }, data: { status: 'closed', closedAt: p.now ?? new Date() } });
  await audit(db, { lodgeId: p.lodgeId, userId: p.user.id, action: 'CREATE', entity: 'ledger-checkpoint', entityId: created.id, detail: { through: p.throughKey, balances: rows } });
  return { ok: true, id: created.id, throughKey: p.throughKey };
}

/** Desfaz a conferência vigente (só Venerável/Administrador, validado na rota). */
export async function undoCheckpoint(db: Db, p: { lodgeId: string; user: { id: string; name: string }; now?: Date }): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await getActiveCheckpoint(db, p.lodgeId);
  if (!current) return { ok: false, error: 'Não há conferência para desfazer.' };
  await db.ledgerCheckpoint.update({ where: { id: current.id }, data: { undoneAt: p.now ?? new Date(), undoneById: p.user.id, undoneByName: p.user.name } });
  await audit(db, { lodgeId: p.lodgeId, userId: p.user.id, action: 'DELETE', entity: 'ledger-checkpoint', entityId: current.id, detail: { through: current.throughKey } });
  return { ok: true };
}

export interface LedgerStatus {
  checkpoint: ActiveCheckpoint | null;
  /** Saldo hoje, ao fim do dia conferido, diferente do informado — algo mudou depois da conferência. */
  drift: BalanceMismatch[];
  /** Há retificação aprovada e vigente (a diferença é esperada até a reconferência). */
  rectificationOpen: boolean;
  pendingRectifications: number;
}

export async function loadLedgerStatus(db: Db, lodgeId: string, now: Date = new Date()): Promise<LedgerStatus> {
  const checkpoint = await getActiveCheckpoint(db, lodgeId);
  const [pending, approved] = await Promise.all([
    db.ledgerRectification.count({ where: { lodgeId, status: 'pending' } }),
    db.ledgerRectification.count({ where: { lodgeId, status: 'approved', closedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
  ]);
  if (!checkpoint) return { checkpoint: null, drift: [], rectificationOpen: approved > 0, pendingRectifications: pending };
  const calc = await balancesAsOf(db, lodgeId, checkpoint.throughKey);
  const drift = compareBalances(
    checkpoint.balances.map((b) => ({ accountId: b.accountId, name: b.name, informed: b.informed, calculated: calc.find((c) => c.accountId === b.accountId)?.calculated ?? 0 })),
  );
  return { checkpoint, drift, rectificationOpen: approved > 0, pendingRectifications: pending };
}

// ---------------------------------------------------------------------------------------------
// Pedido de retificação e ciência

export async function requestRectification(
  db: Db,
  p: { lodgeId: string; user: { id: string; name: string }; reason: string; dateFrom: string; dateTo: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const reason = p.reason.trim();
  if (reason.length < 10) return { ok: false, error: 'Explique o motivo da retificação (pelo menos uma frase).' };
  if (!isDayKey(p.dateFrom) || !isDayKey(p.dateTo) || p.dateFrom > p.dateTo) return { ok: false, error: 'Informe o período a retificar (de e até) com datas válidas.' };
  const checkpoint = await getActiveCheckpoint(db, p.lodgeId);
  if (!checkpoint) return { ok: false, error: 'O livro não está conferido: não há o que retificar, lance normalmente.' };
  if (p.dateFrom > checkpoint.throughKey) return { ok: false, error: 'O período pedido é posterior à conferência — não precisa de retificação.' };
  const created = await db.ledgerRectification.create({
    data: { lodgeId: p.lodgeId, reason, dateFrom: dayKeyToDate(p.dateFrom), dateTo: dayKeyToDate(p.dateTo), requestedById: p.user.id, requestedByName: p.user.name },
    select: { id: true },
  });
  await audit(db, { lodgeId: p.lodgeId, userId: p.user.id, action: 'CREATE', entity: 'ledger-rectification', entityId: created.id, detail: { reason, from: p.dateFrom, to: p.dateTo } });
  return { ok: true, id: created.id };
}

export async function decideRectification(
  db: Db,
  p: { lodgeId: string; id: string; approve: boolean; note?: string | null; user: { id: string; name: string; role: string | null | undefined }; now?: Date },
): Promise<{ ok: true; status: 'approved' | 'rejected'; selfApproved: boolean } | { ok: false; error: string }> {
  const r = await db.ledgerRectification.findFirst({ where: { id: p.id, lodgeId: p.lodgeId } });
  if (!r) return { ok: false, error: 'Pedido não encontrado.' };
  if (r.status !== 'pending') return { ok: false, error: 'Este pedido já foi respondido.' };
  const eligible = await db.user.findMany({ where: { lodgeId: p.lodgeId, status: 'active', role: { in: ['venerable', 'admin'] } }, select: { id: true } });
  const check = checkDecision({ requesterId: r.requestedById, deciderId: p.user.id, deciderRole: p.user.role, eligibleApproverIds: eligible.map((u) => u.id) });
  if (!check.ok) return check;
  const now = p.now ?? new Date();
  const status = p.approve ? 'approved' : 'rejected';
  await db.ledgerRectification.update({
    where: { id: r.id },
    data: { status, decidedById: p.user.id, decidedByName: p.user.name, decidedAt: now, decisionNote: p.note?.trim() || null, selfApproved: check.selfApproved, expiresAt: p.approve ? new Date(now.getTime() + RECTIFICATION_TTL_MS) : null },
  });
  await audit(db, { lodgeId: p.lodgeId, userId: p.user.id, action: 'UPDATE', entity: 'ledger-rectification', entityId: r.id, detail: { decision: status, selfApproved: check.selfApproved, note: p.note ?? null } });
  return { ok: true, status, selfApproved: check.selfApproved };
}

/** O solicitante cancela um pedido pendente; qualquer um que pode decidir (ou o solicitante) encerra um aprovado. */
export async function closeRectification(
  db: Db,
  p: { lodgeId: string; id: string; user: { id: string; name: string; role: string | null | undefined }; now?: Date },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await db.ledgerRectification.findFirst({ where: { id: p.id, lodgeId: p.lodgeId } });
  if (!r) return { ok: false, error: 'Pedido não encontrado.' };
  const mine = r.requestedById === p.user.id;
  const mayDecide = p.user.role === 'venerable' || p.user.role === 'admin';
  if (!mine && !mayDecide) return { ok: false, error: 'Só quem pediu, o Venerável Mestre ou o Administrador encerram este pedido.' };
  if (r.status !== 'pending' && r.status !== 'approved') return { ok: false, error: 'Este pedido já está encerrado.' };
  const now = p.now ?? new Date();
  await db.ledgerRectification.update({ where: { id: r.id }, data: { status: r.status === 'pending' ? 'canceled' : 'closed', closedAt: now } });
  await audit(db, { lodgeId: p.lodgeId, userId: p.user.id, action: 'UPDATE', entity: 'ledger-rectification', entityId: r.id, detail: { closed: true } });
  return { ok: true };
}
