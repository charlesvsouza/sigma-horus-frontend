/* eslint-disable @typescript-eslint/no-explicit-any -- banco falso em memória; só o que o estorno usa */
import test from 'node:test';
import assert from 'node:assert/strict';
import { reverseAsaasPayment } from './asaas-reversal.ts';

// Banco em memória só com o que o estorno usa (sem Postgres): contas, cobranças e pagamentos.
function fakeDb() {
  const payments: any[] = [
    { id: 'p1', lodgeId: 'L', accountId: 'a1', memberId: 'm1', bankAccountId: 'b1', amount: 100, method: 'asaas', note: 'Baixa automática Asaas (pay_1)' },
  ];
  const invoice = { id: 'i1', number: 'COB-1', accountId: 'a1', memberId: 'm1', amount: 100, status: 'paid', asaasPaymentId: 'pay_1', lodgeId: 'L' };
  const account = { id: 'a1', memberId: 'm1', amount: 100, status: 'paid' };
  const sum = (where: any) => payments.filter((p) => p.accountId === where.accountId && (!where.memberId || p.memberId === where.memberId)).reduce((s, p) => s + p.amount, 0);
  const db: any = {
    $executeRaw: async () => 1,
    invoice: { findMany: async () => [invoice], update: async ({ data }: any) => Object.assign(invoice, data) },
    account: { findUnique: async () => account, update: async ({ data }: any) => Object.assign(account, data) },
    member: { findFirst: async () => null },
    auditLog: { create: async () => ({}) },
    payment: {
      findMany: async ({ where }: any) => payments.filter((p) => p.method === where.method && p.accountId === where.accountId && p.note.includes(where.note.contains)),
      findFirst: async ({ where }: any) => payments.find((p) => p.method === where.method && p.accountId === where.accountId && p.note.includes(where.note.contains)) ?? null,
      create: async ({ data }: any) => { payments.push({ id: `p${payments.length + 1}`, ...data }); return data; },
      aggregate: async ({ where }: any) => ({ _sum: { amount: sum(where) } }),
    },
  };
  return { db, payments, invoice, account };
}

test('reembolso: lança Payment negativo, reabre cobrança e conta, e é idempotente', async () => {
  const { db, payments, invoice, account } = fakeDb();
  const r1 = await reverseAsaasPayment(db, { lodgeId: 'L', asaasPaymentId: 'pay_1', event: 'PAYMENT_REFUNDED', userId: 'sys' });
  assert.equal(r1.reversed, 1);
  assert.equal(r1.total, 100);
  assert.deepEqual(r1.invoiceNumbers, ['COB-1']);
  const refund = payments.find((p) => p.method === 'asaas-refund');
  assert.equal(refund.amount, -100);
  assert.equal(refund.bankAccountId, 'b1');
  assert.equal(invoice.status, 'pending');
  assert.equal(account.status, 'pending');
  // webhook reenviado: nada novo
  const r2 = await reverseAsaasPayment(db, { lodgeId: 'L', asaasPaymentId: 'pay_1', event: 'PAYMENT_REFUNDED', userId: 'sys' });
  assert.equal(r2.reversed, 0);
  assert.equal(payments.filter((p) => p.method === 'asaas-refund').length, 1);
});

test('sem baixa automática dessa cobrança, não estorna nada', async () => {
  const { db, payments } = fakeDb();
  payments.length = 0;
  const r = await reverseAsaasPayment(db, { lodgeId: 'L', asaasPaymentId: 'pay_1', event: 'PAYMENT_CHARGEBACK_REQUESTED', userId: 'sys' });
  assert.equal(r.reversed, 0);
});
