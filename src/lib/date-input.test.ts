import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstInvalidDate, parseDateInput } from './date-only.ts';

test('parseDateInput: aceita AAAA-MM-DD e ISO, e devolve o mesmo instante que new Date()', () => {
  assert.equal(parseDateInput('2026-10-05')?.toISOString(), new Date('2026-10-05').toISOString());
  assert.equal(parseDateInput('2026-10-05T14:30:00.000Z')?.toISOString(), '2026-10-05T14:30:00.000Z');
  assert.equal(parseDateInput('2028-02-29')?.toISOString(), '2028-02-29T00:00:00.000Z'); // bissexto
  assert.ok(parseDateInput(new Date('2026-10-05')));
});

test('parseDateInput: recusa texto solto, dia que não existe e ano absurdo', () => {
  for (const bad of ['abc', '', '0', '05/10/2026', '2026-13-01', '2026-00-10', '2026-02-30', '2027-02-29', '2026-04-31', '1999-12-31', '2101-01-01', '5138-11-16', 99999999999999, null, undefined, {}, new Date('x')]) {
    assert.equal(parseDateInput(bad), null, `deveria recusar ${String(bad)}`);
  }
});

test('firstInvalidDate: ignora campo vazio/ausente e aponta o primeiro inválido', () => {
  assert.equal(firstInvalidDate({}, ['dueDate']), null);
  assert.equal(firstInvalidDate({ dueDate: '', paidAt: null }, ['dueDate', 'paidAt']), null);
  assert.equal(firstInvalidDate({ dueDate: '2026-10-05', paidAt: '2026-02-30' }, ['dueDate', 'paidAt']), 'paidAt');
  assert.equal(firstInvalidDate(undefined, ['dueDate']), null);
});

test('piso de ano configurável: patrimônio de 1985 passa só com minYear baixo', () => {
  assert.equal(parseDateInput('1985-06-10'), null);
  assert.equal(parseDateInput('1985-06-10', { minYear: 1900 })?.toISOString(), '1985-06-10T00:00:00.000Z');
  assert.equal(firstInvalidDate({ acquisitionDate: '1985-06-10' }, ['acquisitionDate'], { minYear: 1900 }), null);
  assert.equal(parseDateInput('1850-01-01', { minYear: 1900 }), null);
});
