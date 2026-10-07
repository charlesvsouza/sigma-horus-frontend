import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLedgerOpen, confirmCheckpoint, decideRectification, requestRectification, balancesAsOf } from './ledger-lock-server.ts';
import { allocateOldestFirst } from './split-allocation.ts';

// Banco falso mínimo: só o que a conferência do livro e a retificação usam.
function fakeDb(init: { checkpoint?: { throughDate: string; balances?: unknown[] } | null; rectifications?: Record<string, unknown>[]; payments?: Record<string, unknown>[]; accounts?: Record<string, unknown>[]; users?: { id: string }[] } = {}) {
  const state = {
    checkpoints: init.checkpoint
      ? [{ id: 'cp1', lodgeId: 'l1', throughDate: new Date(`${init.checkpoint.throughDate}T00:00:00.000Z`), balancesJson: JSON.stringify(init.checkpoint.balances ?? []), confirmedByName: 'T', createdAt: new Date('2026-10-01T12:00:00Z'), undoneAt: null }]
      : ([] as Record<string, unknown>[]),
    rects: (init.rectifications ?? []) as Record<string, unknown>[],
    audits: [] as unknown[],
  };
  const db = {
    ledgerCheckpoint: {
      findFirst: async () => (state.checkpoints.filter((c) => !c.undoneAt).sort((a, b) => (b.throughDate as Date).getTime() - (a.throughDate as Date).getTime())[0] ?? null),
      create: async ({ data }: { data: Record<string, unknown> }) => { const row = { id: `cp${state.checkpoints.length + 1}`, createdAt: new Date(), undoneAt: null, ...data }; state.checkpoints.push(row); return { id: row.id }; },
    },
    ledgerRectification: {
      findMany: async ({ where }: { where: { status?: string; closedAt?: null } }) => state.rects.filter((r) => (!where.status || r.status === where.status) && (where.closedAt === undefined || r.closedAt === null || r.closedAt === undefined)),
      findFirst: async ({ where }: { where: { id: string } }) => state.rects.find((r) => r.id === where.id) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => { const row = { id: `r${state.rects.length + 1}`, status: 'pending', closedAt: null, usedCount: 0, ...data }; state.rects.push(row); return { id: row.id }; },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = state.rects.find((r) => r.id === where.id)!;
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'increment' in (v as object)) row[k] = (Number(row[k]) || 0) + (v as { increment: number }).increment;
          else row[k] = v;
        }
        return row;
      },
      updateMany: async ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => { for (const r of state.rects.filter((x) => x.status === where.status && !x.closedAt)) Object.assign(r, data); return { count: 0 }; },
      count: async () => 0,
    },
    auditLog: { create: async (a: unknown) => { state.audits.push(a); return a; } },
    financialAccount: { findMany: async () => init.accounts ?? [{ id: 'a1', name: 'CC', active: true, openingBalance: 0 }] },
    payment: { findMany: async () => init.payments ?? [] },
    accountTransfer: { findMany: async () => [] },
    user: { findMany: async () => init.users ?? [{ id: 'v1' }] },
  };
  return { db: db as never, state };
}

const approved = (over: Record<string, unknown> = {}) => ({ id: 'r1', status: 'approved', dateFrom: new Date('2026-09-01T00:00:00Z'), dateTo: new Date('2026-09-28T00:00:00Z'), expiresAt: new Date('2099-01-01T00:00:00Z'), closedAt: null, usedCount: 0, ...over });

test('sem conferência, qualquer data passa', async () => {
  const { db } = fakeDb();
  assert.deepEqual(await checkLedgerOpen(db, 'l1', [new Date('2026-09-10T00:00:00Z')]), { ok: true, rectificationIds: [] });
});

test('com conferência até 28/09: dia anterior bloqueia, dia seguinte passa', async () => {
  const { db } = fakeDb({ checkpoint: { throughDate: '2026-09-28' } });
  const blocked = await checkLedgerOpen(db, 'l1', [new Date('2026-09-10T00:00:00Z')]);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.match(blocked.error, /28\/09\/2026/);
  assert.equal((await checkLedgerOpen(db, 'l1', [new Date('2026-09-29T00:00:00Z')])).ok, true);
  // instante das 22h de Brasília do dia 28 (= 29 01h UTC) ainda é dia 28: bloqueado
  assert.equal((await checkLedgerOpen(db, 'l1', [new Date('2026-09-29T01:00:00Z')])).ok, false);
});

test('retificação aprovada e vigente libera e conta o uso; dryRun não conta', async () => {
  const { db, state } = fakeDb({ checkpoint: { throughDate: '2026-09-28' }, rectifications: [approved()] });
  const dry = await checkLedgerOpen(db, 'l1', [new Date('2026-09-10T00:00:00Z')], { dryRun: true });
  assert.equal(dry.ok, true);
  assert.equal(state.rects[0].usedCount, 0);
  const real = await checkLedgerOpen(db, 'l1', [new Date('2026-09-10T00:00:00Z')], { userId: 'u1', what: 'payment.edit' });
  assert.deepEqual(real, { ok: true, rectificationIds: ['r1'] });
  assert.equal(state.rects[0].usedCount, 1);
  assert.equal(state.audits.length, 1);
  // uma data dentro e outra fora da janela: bloqueia
  const partial = await checkLedgerOpen(db, 'l1', [new Date('2026-09-10T00:00:00Z'), new Date('2026-08-20T00:00:00Z')]);
  assert.equal(partial.ok, false);
});

test('retificação vencida não libera', async () => {
  const { db } = fakeDb({ checkpoint: { throughDate: '2026-09-28' }, rectifications: [approved({ expiresAt: new Date('2026-10-01T00:00:00Z') })] });
  assert.equal((await checkLedgerOpen(db, 'l1', [new Date('2026-09-10T00:00:00Z')], { now: new Date('2026-10-07T00:00:00Z') })).ok, false);
});

test('conferência só aceita se o saldo do banco bater ao centavo', async () => {
  const payments = [{ bankAccountId: 'a1', amount: 100, paidAt: new Date('2026-09-11T00:00:00Z'), account: { type: 'RECEIVABLE' } }];
  const now = new Date('2026-10-07T12:00:00Z');
  const { db, state } = fakeDb({ payments });
  const bad = await confirmCheckpoint(db, { lodgeId: 'l1', throughKey: '2026-09-28', informed: { a1: 99.99 }, user: { id: 'u1', name: 'T' }, now });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.mismatches?.[0].difference, -0.01);
  assert.equal(state.checkpoints.length, 0);
  const ok = await confirmCheckpoint(db, { lodgeId: 'l1', throughKey: '2026-09-28', informed: { a1: 100 }, user: { id: 'u1', name: 'T' }, now });
  assert.equal(ok.ok, true);
  assert.equal(state.checkpoints.length, 1);
  // hoje e dias futuros não se conferem
  const today = await confirmCheckpoint(db, { lodgeId: 'l1', throughKey: '2026-10-07', informed: { a1: 100 }, user: { id: 'u1', name: 'T' }, now });
  assert.equal(today.ok, false);
});

test('não volta a conferência para antes da vigente', async () => {
  const { db } = fakeDb({ checkpoint: { throughDate: '2026-09-28' } });
  const r = await confirmCheckpoint(db, { lodgeId: 'l1', throughKey: '2026-09-20', informed: { a1: 0 }, user: { id: 'u1', name: 'T' }, now: new Date('2026-10-07T12:00:00Z') });
  assert.equal(r.ok, false);
});

test('saldo ao fim do dia respeita o dia contábil (Pix das 22h do dia 28 conta no 28)', async () => {
  const payments = [
    { bankAccountId: 'a1', amount: 10, paidAt: new Date('2026-09-28T00:00:00Z'), account: { type: 'RECEIVABLE' } },
    { bankAccountId: 'a1', amount: 5, paidAt: new Date('2026-09-29T01:00:00Z'), account: { type: 'RECEIVABLE' } }, // 22h do dia 28
    { bankAccountId: 'a1', amount: 7, paidAt: new Date('2026-09-29T00:00:00Z'), account: { type: 'RECEIVABLE' } }, // dia 29
  ];
  const { db } = fakeDb({ payments });
  const [a] = await balancesAsOf(db, 'l1', '2026-09-28');
  assert.equal(a.calculated, 15);
});

test('fluxo de ciência: Tesoureiro pede, Venerável concorda; o solicitante não aprova a si mesmo', async () => {
  const { db, state } = fakeDb({ checkpoint: { throughDate: '2026-09-28' }, users: [{ id: 'v1' }, { id: 'a1' }] });
  const req = await requestRectification(db, { lodgeId: 'l1', user: { id: 't1', name: 'Tesoureiro' }, reason: 'Corrigir o valor lançado errado', dateFrom: '2026-09-01', dateTo: '2026-09-28' });
  assert.equal(req.ok, true);
  const self = await decideRectification(db, { lodgeId: 'l1', id: 'r1', approve: true, user: { id: 't1', name: 'Tesoureiro', role: 'treasurer' } });
  assert.equal(self.ok, false);
  const ok = await decideRectification(db, { lodgeId: 'l1', id: 'r1', approve: true, user: { id: 'v1', name: 'Venerável', role: 'venerable' }, now: new Date('2026-10-07T12:00:00Z') });
  assert.equal(ok.ok, true);
  assert.equal(state.rects[0].status, 'approved');
  assert.equal((state.rects[0].expiresAt as Date).toISOString(), '2026-10-09T12:00:00.000Z');
  const again = await decideRectification(db, { lodgeId: 'l1', id: 'r1', approve: false, user: { id: 'v1', name: 'Venerável', role: 'venerable' } });
  assert.equal(again.ok, false);
});

test('pedido exige motivo, período válido e conferência existente', async () => {
  const sem = fakeDb();
  assert.equal((await requestRectification(sem.db, { lodgeId: 'l1', user: { id: 't', name: 'T' }, reason: 'Corrigir o valor lançado errado', dateFrom: '2026-09-01', dateTo: '2026-09-02' })).ok, false);
  const { db } = fakeDb({ checkpoint: { throughDate: '2026-09-28' } });
  assert.equal((await requestRectification(db, { lodgeId: 'l1', user: { id: 't', name: 'T' }, reason: 'curto', dateFrom: '2026-09-01', dateTo: '2026-09-02' })).ok, false);
  assert.equal((await requestRectification(db, { lodgeId: 'l1', user: { id: 't', name: 'T' }, reason: 'Corrigir o valor lançado errado', dateFrom: '2026-09-05', dateTo: '2026-09-02' })).ok, false);
  assert.equal((await requestRectification(db, { lodgeId: 'l1', user: { id: 't', name: 'T' }, reason: 'Corrigir o valor lançado errado', dateFrom: '2026-10-05', dateTo: '2026-10-06' })).ok, false);
});

test('rateio das mensalidades adiantadas: da mais antiga para a mais nova, sem passar do saldo', () => {
  const open = [
    { accountId: 'a', title: 'Out', dueDate: new Date('2026-10-05T00:00:00Z'), remaining: 110 },
    { accountId: 'b', title: 'Nov', dueDate: new Date('2026-11-05T00:00:00Z'), remaining: 110 },
    { accountId: 'c', title: 'Dez', dueDate: new Date('2026-12-05T00:00:00Z'), remaining: 110 },
  ];
  const r = allocateOldestFirst(open, 250);
  assert.deepEqual(r.allocations.map((a) => [a.accountId, a.amount, a.remainingAfter]), [['a', 110, 0], ['b', 110, 0], ['c', 30, 80]]);
  assert.equal(r.unallocated, 0);
  const over = allocateOldestFirst(open, 400);
  assert.equal(over.unallocated, 70);
});
