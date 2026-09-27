import test from 'node:test';
import assert from 'node:assert/strict';
import { canConvert, deliveryStatement, initialStatus, isPermanent, isSupplyKind, needsCatalogManager, needsLodgeStock, removesFromCatalog } from './material-supply.ts';

test('venda e doação exigem quem cuida do cadastro; empréstimo e Potência, só o inventário', () => {
  assert.equal(needsCatalogManager('sale'), true);
  assert.equal(needsCatalogManager('donation'), true);
  assert.equal(needsCatalogManager('loan'), false);
  assert.equal(needsCatalogManager('potencia'), false);
});

test('só o empréstimo volta; as demais modalidades nascem entregues', () => {
  assert.equal(isPermanent('loan'), false);
  assert.equal(initialStatus('loan'), 'issued');
  for (const k of ['potencia', 'sale', 'donation'] as const) {
    assert.equal(isPermanent(k), true);
    assert.equal(initialStatus(k), 'delivered');
  }
});

test('material da Potência não usa nem baixa o estoque da loja', () => {
  assert.equal(needsLodgeStock('potencia'), false);
  assert.equal(removesFromCatalog('potencia'), false);
  assert.equal(needsLodgeStock('sale'), true);
  assert.equal(removesFromCatalog('sale'), true);
  assert.equal(removesFromCatalog('donation'), true);
  assert.equal(removesFromCatalog('loan'), false); // empréstimo só reserva enquanto estiver com o obreiro
});

test('conversão: só empréstimo em aberto, e para outra modalidade', () => {
  assert.equal(canConvert({ kind: 'loan', status: 'issued' }, 'potencia'), true);
  assert.equal(canConvert({ kind: 'loan', status: 'returned' }, 'potencia'), false);
  assert.equal(canConvert({ kind: 'loan', status: 'issued' }, 'loan'), false);
  assert.equal(canConvert({ kind: 'sale', status: 'delivered' }, 'donation'), false);
});

test('texto do termo de entrega cita a Potência pelo nome', () => {
  assert.match(deliveryStatement('potencia', 'GLMERJ'), /pela GLMERJ, sem custo para a loja e para o obreiro/);
  assert.match(deliveryStatement('potencia', null), /pela Potência/);
  assert.equal(isSupplyKind('venda'), false);
  assert.equal(isSupplyKind('sale'), true);
});
