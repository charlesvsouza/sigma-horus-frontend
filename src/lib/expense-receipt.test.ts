import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentExpenseReceipt } from './expense-receipt';

const row = (iso: string, key: string) => ({ createdAt: new Date(iso), after: JSON.stringify({ receiptKey: key, receiptName: `${key}.pdf`, receiptType: 'application/pdf' }) });

test('sem anexo: nenhum comprovante', () => {
  assert.equal(currentExpenseReceipt([], []), null);
});

test('o anexo mais recente vale', () => {
  const r = currentExpenseReceipt([row('2026-10-01T10:00:00Z', 'a'), row('2026-10-02T10:00:00Z', 'b')], []);
  assert.equal(r?.receiptKey, 'b');
});

test('remoção mais nova encerra o comprovante; novo anexo depois da remoção volta a valer', () => {
  assert.equal(currentExpenseReceipt([row('2026-10-01T10:00:00Z', 'a')], [{ createdAt: new Date('2026-10-02T10:00:00Z') }]), null);
  assert.equal(currentExpenseReceipt([row('2026-10-01T10:00:00Z', 'a'), row('2026-10-03T10:00:00Z', 'c')], [{ createdAt: new Date('2026-10-02T10:00:00Z') }])?.receiptKey, 'c');
});

test('metadados ilegíveis são ignorados', () => {
  assert.equal(currentExpenseReceipt([{ createdAt: new Date(), after: 'x{' }], []), null);
});
