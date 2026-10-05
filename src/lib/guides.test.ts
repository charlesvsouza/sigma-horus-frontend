import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES, getGuide } from './guides.ts';
import { getModulePage } from './module-pages.ts';

test('guias: slugs únicos, título curto e descrição dentro do que o Google exibe', () => {
  assert.equal(new Set(GUIDES.map((g) => g.slug)).size, GUIDES.length);
  for (const g of GUIDES) {
    assert.match(g.slug, /^[a-z0-9-]+$/);
    assert.ok(g.short.length <= 48, `${g.slug}: título curto com ${g.short.length}`);
    assert.ok(g.description.length >= 80 && g.description.length <= 170, `${g.slug}: descrição com ${g.description.length}`);
    assert.match(g.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(g.blocks.length >= 3);
    assert.equal(getGuide(g.slug), g);
    assert.ok(getModulePage(g.moduleSlug), `${g.slug}: página de módulo ${g.moduleSlug} não existe`);
    assert.ok(!g.publishedAt || g.publishedAt <= g.updatedAt, `${g.slug}: publicado depois de atualizado`);
  }
  assert.equal(getGuide('nao-existe'), undefined);
});

test('guias: sem dado de loja, irmão ou valor (conteúdo público e genérico)', () => {
  const text = JSON.stringify(GUIDES);
  assert.ok(!/amm139|horus-reaa|Tim Maia|R\$\s?\d/i.test(text));
});
