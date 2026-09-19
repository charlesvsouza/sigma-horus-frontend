import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, csvRow } from './csv.ts';

test('campos comuns passam sem alteração', () => {
  assert.equal(csvCell('Mensalidade'), 'Mensalidade');
  assert.equal(csvCell(12.5), '12.5');
  assert.equal(csvCell(null), '');
});

test('fórmulas ganham apóstrofo (CSV injection)', () => {
  assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell('+1+1'), "'+1+1");
  assert.equal(csvCell('-2'), "'-2");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
});

test('separador, aspas e quebra de linha ficam entre aspas', () => {
  assert.equal(csvCell('a;b'), '"a;b"');
  assert.equal(csvCell('diz "oi"'), '"diz ""oi"""');
  assert.equal(csvCell('linha1\nlinha2'), '"linha1\nlinha2"');
});

test('csvRow junta com ponto e vírgula', () => {
  assert.equal(csvRow(['a', 'b;c', 3]), 'a;"b;c";3');
});
