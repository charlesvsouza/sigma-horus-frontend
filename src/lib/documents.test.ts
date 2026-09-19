import test from 'node:test';
import assert from 'node:assert/strict';
import { isInternalCategory, memberCanAccessDocument, DOCUMENT_CATEGORY_SUGGESTIONS } from './documents.ts';

test('"Interno Loja" está entre as categorias sugeridas', () => {
  assert.ok(DOCUMENT_CATEGORY_SUGGESTIONS.includes('Interno Loja'));
});

test('categoria interna é reconhecida sem depender de maiúsculas/espaços', () => {
  assert.equal(isInternalCategory('Interno Loja'), true);
  assert.equal(isInternalCategory('  interno loja '), true);
  assert.equal(isInternalCategory('Institucional'), false);
  assert.equal(isInternalCategory(null), false);
});

test('irmão: vê institucional e os próprios, nunca o interno nem o de outro irmão', () => {
  assert.equal(memberCanAccessDocument({ memberId: null, category: 'Institucional' }, 'm1'), true);
  assert.equal(memberCanAccessDocument({ memberId: null, category: null }, 'm1'), true);
  assert.equal(memberCanAccessDocument({ memberId: 'm1', category: 'Geral' }, 'm1'), true);
  assert.equal(memberCanAccessDocument({ memberId: 'm2', category: 'Geral' }, 'm1'), false);
  assert.equal(memberCanAccessDocument({ memberId: null, category: 'Interno Loja' }, 'm1'), false);
  assert.equal(memberCanAccessDocument({ memberId: 'm1', category: 'interno loja' }, 'm1'), false);
  assert.equal(memberCanAccessDocument({ memberId: 'm1', category: 'Geral' }, null), false);
});
