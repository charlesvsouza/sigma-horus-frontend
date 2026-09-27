import test from 'node:test';
import assert from 'node:assert/strict';
import { matchNoticesToBank, noticeTxid } from './notice-bank-match.ts';

const at = (iso: string) => new Date(iso);
const notice = (accountId: string, balance: number, noticeAt = '2026-09-27T15:00:00Z') => ({ accountId, balance, noticeAt: at(noticeAt) });
const line = (id: string, amount: number, date = '2026-09-27T00:00:00Z', description = 'PIX RECEBIDO') => ({ id, amount, date: at(date), description });

test('txid do Pix na descrição casa mesmo com valor diferente e fora da janela', () => {
  const m = matchNoticesToBank(
    [notice('cmg1abcdefghij0123456789', 110)],
    [line('l1', 100, '2026-09-10T00:00:00Z', 'PIX REC FULANO CMG1ABCDEFGHIJ0123456789')],
  );
  assert.deepEqual(m.get('cmg1abcdefghij0123456789'), { lineId: 'l1', date: '2026-09-10T00:00:00.000Z', amount: 100, description: 'PIX REC FULANO CMG1ABCDEFGHIJ0123456789', by: 'txid' });
  assert.equal(noticeTxid('cmg1-abc_def'), 'cmg1abcdef');
});

test('sem txid: mesmo valor em até 3 dias do aviso, e só quando é inequívoco', () => {
  const m = matchNoticesToBank(
    [notice('a1', 1), notice('a2', 110)],
    [line('l1', 1), line('l2', 110.001, '2026-09-29T00:00:00Z'), line('l3', -110), line('l4', 110, '2026-10-05T00:00:00Z')],
  );
  assert.equal(m.get('a1')?.lineId, 'l1');
  assert.equal(m.get('a1')?.by, 'amount');
  assert.equal(m.get('a2')?.lineId, 'l2'); // l3 é débito; l4 fora da janela
});

test('ambíguo não casa: duas linhas iguais para um aviso, ou dois avisos para uma linha', () => {
  assert.equal(matchNoticesToBank([notice('a1', 110)], [line('l1', 110), line('l2', 110)]).size, 0);
  assert.equal(matchNoticesToBank([notice('a1', 110), notice('a2', 110)], [line('l1', 110)]).size, 0);
});

test('linha usada pelo txid não serve para outro aviso por valor', () => {
  const m = matchNoticesToBank(
    [notice('cmg1abcdefghij0123456789', 110), notice('a2', 110)],
    [line('l1', 110, '2026-09-27T00:00:00Z', 'PIX cmg1abcdefghij0123456789')],
  );
  assert.equal(m.get('cmg1abcdefghij0123456789')?.lineId, 'l1');
  assert.equal(m.has('a2'), false);
});
