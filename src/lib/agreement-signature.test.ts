import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalAgreement, generateSignatureCode, hashAgreement, normalizeSignatureCode, partyForSigner, type AgreementContent } from './agreement-signature.ts';

const base: AgreementContent = {
  blockId: 'b1', memberId: 'm1', memberName: 'Irmão Teste', total: 590, regularizationFee: 150, extraCharge: 20, installments: 2,
  firstDueDate: new Date('2026-10-03T00:00:00Z'),
  items: [
    { kind: 'debt', title: 'Mensalidade ago', openAmount: 120, sortOrder: 3 },
    { kind: 'fee', title: 'Taxa de regularização', openAmount: 150, sortOrder: 0 },
  ],
};

test('quem assina por qual parte', () => {
  assert.equal(partyForSigner('admin', false), 'venerable');
  assert.equal(partyForSigner('venerable', false), 'venerable');
  assert.equal(partyForSigner('treasurer', false), 'treasurer');
  assert.equal(partyForSigner('member', true), 'member');
  assert.equal(partyForSigner('member', false), null); // outro irmão não assina por ele
  for (const r of ['secretary', 'hospitaller', 'candidate', '', null, undefined]) assert.equal(partyForSigner(r, true), null);
});

test('o hash não depende da ordem em que os itens chegam, e muda se qualquer termo do acordo muda', () => {
  const reversed = { ...base, items: [...base.items].reverse() };
  assert.equal(hashAgreement(base), hashAgreement(reversed));
  assert.match(hashAgreement(base), /^[0-9a-f]{64}$/);
  assert.notEqual(hashAgreement(base), hashAgreement({ ...base, total: 591 }));
  assert.notEqual(hashAgreement(base), hashAgreement({ ...base, installments: 3 }));
  assert.notEqual(hashAgreement(base), hashAgreement({ ...base, items: [{ ...base.items[0], openAmount: 121 }, base.items[1]] }));
  assert.notEqual(hashAgreement(base), hashAgreement({ ...base, firstDueDate: new Date('2026-10-04T00:00:00Z') }));
  assert.ok(canonicalAgreement(base).startsWith('termo-acordo-regularizacao/v1'));
});

test('código de verificação: formato AC-XXXX-XXXX sem caracteres ambíguos, e normaliza o que o usuário digita', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const c = generateSignatureCode();
    assert.match(c, /^AC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    seen.add(c);
  }
  assert.ok(seen.size > 190);
  assert.equal(normalizeSignatureCode('ac-k7m2-9pqx'), 'AC-K7M2-9PQX');
  assert.equal(normalizeSignatureCode(' ack7m29pqx '), 'AC-K7M2-9PQX');
  assert.equal(normalizeSignatureCode('XX-K7M2-9PQX'), null);
  assert.equal(normalizeSignatureCode('AC-123'), null);
});
