import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFinancial, quickAccess } from './member-quick.ts';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const TODAY = d('2026-10-05');

test('quickAccess: financeiro só para Tesoureiro, Venerável e Administrador com leitura de Contas', () => {
  assert.deepEqual(quickAccess(true, true, 'treasurer'), { contact: true, financial: true });
  assert.deepEqual(quickAccess(true, true, 'venerable'), { contact: true, financial: true });
  assert.deepEqual(quickAccess(true, true, 'admin'), { contact: true, financial: true });
  // Secretário: cadastro sim, dinheiro não
  assert.deepEqual(quickAccess(true, false, 'secretary'), { contact: true, financial: false });
  // Hospitaleiro lê Contas só por causa do Tronco: não ganha o financeiro dos irmãos
  assert.deepEqual(quickAccess(true, true, 'hospitaller'), { contact: true, financial: false });
  // sem Membros nem financeiro: nada
  assert.equal(quickAccess(false, false, 'member'), null);
  assert.equal(quickAccess(false, true, 'hospitaller'), null);
  // papel desconhecido com Contas liberado na matriz continua sem o financeiro
  assert.deepEqual(quickAccess(false, true, 'treasurer'), { contact: false, financial: true });
});

test('buildFinancial: saldo devedor, vencido, crédito e pendências ordenadas', () => {
  const r = buildFinancial([
    { id: 'a', title: 'Mensalidade 10/2026', type: 'RECEIVABLE', amount: 140, dueDate: d('2026-09-21'), status: 'pending', payments: [] },
    { id: 'b', title: 'Mensalidade 11/2026', type: 'RECEIVABLE', amount: 140, dueDate: d('2026-11-05'), status: 'pending', payments: [] },
    { id: 'c', title: 'Taxa — entrada', type: 'RECEIVABLE', amount: 200, dueDate: d('2026-10-05'), status: 'pending', payments: [{ amount: 50 }] },
    { id: 'd', title: 'Paga', type: 'RECEIVABLE', amount: 100, dueDate: d('2026-08-05'), status: 'paid', payments: [{ amount: 100 }] },
    { id: 'e', title: 'Reembolso', type: 'PAYABLE', amount: 80, dueDate: d('2026-10-01'), status: 'pending', payments: [] },
    { id: 'f', title: 'Quitada por pagamentos', type: 'RECEIVABLE', amount: 60, dueDate: d('2026-09-01'), status: 'pending', payments: [{ amount: 60 }] },
  ], TODAY);
  assert.equal(r.debt, 430);      // 140 + 140 + (200−50)
  assert.equal(r.overdue, 140);   // só a de 21/09 (a de hoje ainda não venceu)
  assert.equal(r.credit, 80);
  assert.deepEqual(r.pending.map((p) => p.id), ['a', 'c', 'b']);
  assert.equal(r.pending[0].daysOverdue, 14);
  assert.equal(r.pending[0].overdue, true);
  assert.equal(r.pending[1].overdue, false); // vence hoje: em dia
  assert.equal(r.pending[1].balance, 150);
});

test('buildFinancial: sem lançamentos, tudo zerado', () => {
  assert.deepEqual(buildFinancial([], TODAY), { debt: 0, overdue: 0, credit: 0, pending: [] });
});
