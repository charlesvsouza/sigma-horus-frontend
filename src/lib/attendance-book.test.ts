import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceBookRows } from './attendance-book.ts';

test('livro de presença: cargos na ordem ritualística primeiro, depois os demais em ordem alfabética', () => {
  const rows = attendanceBookRows([
    { id: '1', name: 'Zeca', degree: 'Aprendiz', offices: [] },
    { id: '2', name: 'Bruno', degree: 'Mestre', offices: [{ name: 'Secretário', order: 9 }] },
    { id: '3', name: 'Álvaro', degree: 'Companheiro', offices: [] },
    { id: '4', name: 'Carlos', degree: 'Mestre Instalado', offices: [{ name: 'Venerável Mestre', order: 1 }] },
    { id: '5', name: 'Davi', degree: null, offices: [{ name: 'Hospitaleiro', order: 12 }, { name: '1º Vigilante', order: 2 }] },
  ]);
  assert.deepEqual(rows.map((r) => r.name), ['Carlos', 'Davi', 'Bruno', 'Álvaro', 'Zeca']);
  assert.deepEqual(rows.map((r) => r.n), [1, 2, 3, 4, 5]);
  assert.equal(rows[1].office, '1º Vigilante, Hospitaleiro');
  assert.equal(rows[1].degree, '—');
});
