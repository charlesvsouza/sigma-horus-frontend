import test from 'node:test';
import assert from 'node:assert/strict';
import {
  artBytesMatch, artDateParts, artLodgeLine, artUploadError, parseCertificateArtLayout, signatureRoleOf,
} from './certificate-art.ts';

const field = { x0: 208, x1: 675.5, y: 250, size: 17 };

test('layout: exige página e a linha do nome; ignora campos inválidos', () => {
  assert.equal(parseCertificateArtLayout(null), null);
  assert.equal(parseCertificateArtLayout({ width: 842, height: 596, fields: {} }), null);
  const l = parseCertificateArtLayout({
    width: 842, height: 596, ink: '#1C2949',
    fields: { name: field, lodge: { x0: 272, x1: 677.5, y: 270, size: 14 }, day: { x0: 1, x1: 2, y: 3, size: 13 }, month: 'x' },
    signatures: [{ role: 'secretary', x0: 525, x1: 670, y: 476, size: 12 }, { role: 'chanceler', x0: 1, x1: 100, y: 1, size: 9 }],
  });
  assert.ok(l);
  assert.equal(l.ink, '#1C2949');
  assert.deepEqual(Object.keys(l.fields), ['name', 'lodge']); // day estreito demais, month inválido
  assert.deepEqual(l.signatures?.map((s) => s.role), ['secretary']);
});

test('layout: cor inválida volta ao azul-marinho; campo fora da página é descartado', () => {
  const l = parseCertificateArtLayout({ width: 842, height: 596, ink: 'azul', fields: { name: field, year: { x0: 476, x1: 900, y: 413, size: 13 } } });
  assert.equal(l?.ink, '#1c2949');
  assert.equal(l?.fields.year, undefined);
});

test('data da sessão no calendário de Brasília, com 1º', () => {
  // 22h de 30/09 em Brasília = 01h de 01/10 em UTC: continua sendo 30 de setembro.
  assert.deepEqual(artDateParts(new Date('2026-10-01T01:00:00Z')), { day: '30', month: 'setembro', year: '2026' });
  assert.deepEqual(artDateParts(new Date('2026-10-01T22:00:00Z')), { day: '1º', month: 'outubro', year: '2026' });
});

test('linha da Loja: tira o título que a arte já traz', () => {
  assert.equal(artLodgeLine('Estrela do Oriente', '1234'), 'Estrela do Oriente nº 1234');
  assert.equal(artLodgeLine('A∴R∴L∴S∴ Tim Maia', '7'), 'Tim Maia nº 7');
  assert.equal(artLodgeLine('A.R.L.S. Cavaleiros da Luz', null), 'Cavaleiros da Luz');
  assert.equal(artLodgeLine('ARLS Fraternidade', '12'), 'Fraternidade nº 12');
  assert.equal(artLodgeLine('Loja Acácia', '3'), 'Acácia nº 3');
  assert.equal(artLodgeLine('Augusta e Respeitável Loja Simbólica Luz do Sul', '9'), 'Luz do Sul nº 9');
  assert.equal(artLodgeLine('A∴R∴B∴L∴M∴ Antonio Monteiro Martins', '139'), 'Antonio Monteiro Martins nº 139');
  assert.equal(artLodgeLine('Alvorada', null), 'Alvorada'); // "A" do nome não é prefixo
  assert.equal(artLodgeLine(null, '5'), 'nº 5');
  assert.equal(artLodgeLine('  ', null), null);
});

test('cargo do signatário → papel no layout', () => {
  assert.equal(signatureRoleOf('Venerável Mestre'), 'venerable');
  assert.equal(signatureRoleOf('Secretário'), 'secretary');
  assert.equal(signatureRoleOf('Chanceler'), 'chancellor');
  assert.equal(signatureRoleOf('Tesoureiro'), null);
});

test('upload da arte: tipo, tamanho e bytes conferidos', () => {
  assert.deepEqual(artUploadError({ type: 'image/jpeg', size: 900_000 }), { type: 'jpg' });
  assert.deepEqual(artUploadError({ type: 'application/pdf', size: 1000 }), { type: 'pdf' });
  assert.ok('error' in artUploadError({ type: 'image/webp', size: 1000 }));
  assert.ok('error' in artUploadError({ type: 'image/png', size: 5 * 1024 * 1024 }));
  assert.equal(artBytesMatch(new Uint8Array([0xff, 0xd8, 0xff]), 'jpg'), true);
  assert.equal(artBytesMatch(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'pdf'), true);
  assert.equal(artBytesMatch(new Uint8Array([0xff, 0xd8, 0xff]), 'png'), false);
});

test('layout com área de texto (arte sem o miolo): dispensa os campos; área pequena demais é recusada', () => {
  const l = parseCertificateArtLayout({ width: 842, height: 596, textBox: { x0: 165, x1: 680, y0: 214, y1: 424 }, fields: {} });
  assert.deepEqual(l?.textBox, { x0: 165, x1: 680, y0: 214, y1: 424 });
  assert.deepEqual(l?.fields, {});
  assert.equal(parseCertificateArtLayout({ width: 842, height: 596, textBox: { x0: 165, x1: 300, y0: 214, y1: 260 }, fields: {} }), null);
});
