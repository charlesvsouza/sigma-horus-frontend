import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Corpo que não é JSON não pode derrubar a rota com erro 500: toda `await request.json()` precisa de
// `.catch` (e responder 400) ou estar dentro de um try/catch que já trata a falha. Rota nova que esquecer
// a guarda derruba este teste.

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');

// Já tratam a falha de leitura por conta própria (try/catch com resposta adequada).
const HANDLED = new Set(['account/forgot-password/route.ts', 'account/reset-password/route.ts', 'asaas/webhook/route.ts']);

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? routeFiles(p) : e.name === 'route.ts' ? [p] : [];
  });
}

test('toda leitura de JSON do corpo tem guarda contra corpo inválido', () => {
  const bad: string[] = [];
  for (const file of routeFiles(API_DIR)) {
    const rel = path.relative(API_DIR, file).replace(/\\/g, '/');
    if (HANDLED.has(rel)) continue;
    const src = fs.readFileSync(file, 'utf8');
    if (/await\s+(?:request|req)\.json\(\)(?!\s*\.catch)/.test(src)) bad.push(rel);
  }
  assert.deepEqual(bad, [], `rotas com request.json() sem .catch: ${bad.join(', ')}`);
});
