import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_PAGES, modulePageWords } from './module-pages.ts';

const EXPECTED = ['tesouraria-loja-maconica', 'controle-de-mensalidades', 'portal-do-irmao', 'secretaria-loja-maconica', 'chancelaria-loja-maconica', 'hospitalaria-loja-maconica'];

test('as seis páginas de módulo existem, com rota única', () => {
  assert.deepEqual(MODULE_PAGES.map((m) => m.slug), EXPECTED);
  assert.equal(new Set(MODULE_PAGES.map((m) => m.slug)).size, EXPECTED.length);
});

test('cada página tem 400 a 800 palavras, FAQ próprio e meta dentro do limite do Google', () => {
  for (const m of MODULE_PAGES) {
    const words = modulePageWords(m);
    assert.ok(words >= 400 && words <= 800, `${m.slug}: ${words} palavras`);
    assert.ok(m.faq.length >= 3, `${m.slug}: FAQ curto demais`);
    assert.ok(m.description.length <= 170, `${m.slug}: descrição com ${m.description.length} caracteres`);
    assert.ok(m.short.length <= 62, `${m.slug}: título com ${m.short.length} caracteres`);
    assert.ok(m.h1.length > 10);
  }
});

test('texto não promete o que não existe: sem avaliação, depoimento, número de lojas nem "grátis" sem ressalva', () => {
  for (const m of MODULE_PAGES) {
    const text = JSON.stringify(m).toLowerCase();
    for (const banned of ['depoimento', 'avaliação 5', 'lojas já usam', 'grátis', 'gratuito', 'aggregaterating']) {
      assert.ok(!text.includes(banned), `${m.slug} contém "${banned}"`);
    }
  }
});
