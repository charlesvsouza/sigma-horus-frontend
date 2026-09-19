import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Lê o código-fonte em vez de importar backup.ts (que abriria conexão com o banco).
const schema = readFileSync('prisma/schema.prisma', 'utf-8');
const source = readFileSync('src/lib/backup.ts', 'utf-8');

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
// BackupLog é o próprio registro do backup — fica de fora de propósito.
const EXCLUDED = new Set(['backupLog']);

const schemaModels = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => lowerFirst(m[1]));
const listBlock = source.match(/BACKUP_MODELS = \[([\s\S]*?)\] as const/)?.[1] ?? '';
const backupModels = [...listBlock.matchAll(/'(\w+)'/g)].map((m) => m[1]);

test('todo modelo do schema entra no backup (menos os excluídos de propósito)', () => {
  const missing = schemaModels.filter((m) => !EXCLUDED.has(m) && !backupModels.includes(m));
  assert.deepEqual(missing, [], `Tabelas fora do backup diário — adicione em BACKUP_MODELS: ${missing.join(', ')}`);
});

test('o backup não lista modelos que não existem no schema', () => {
  const unknown = backupModels.filter((m) => !schemaModels.includes(m));
  assert.deepEqual(unknown, []);
});

test('o backup não repete modelos', () => {
  assert.equal(new Set(backupModels).size, backupModels.length);
});

test('cada modelo vem depois dos modelos de que depende (ordem da restauração)', () => {
  // Chaves estrangeiras reais: campo com @relation(fields: [x]) apontando para outro modelo.
  const order = (m: string) => backupModels.indexOf(m);
  for (const model of schema.split(/^model /m).slice(1)) {
    const name = lowerFirst(model.match(/^(\w+)/)![1]);
    if (!backupModels.includes(name)) continue;
    for (const rel of model.matchAll(/^\s+\w+\s+(\w+)\??\s+@relation\(fields:/gm)) {
      const target = lowerFirst(rel[1]);
      if (target === name || !backupModels.includes(target)) continue;
      assert.ok(order(target) < order(name), `${name} precisa vir depois de ${target} em BACKUP_MODELS`);
    }
  }
});
