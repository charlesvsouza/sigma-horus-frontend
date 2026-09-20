import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Inventário: toda rota de API que ESCREVE precisa (a) passar pela guarda de assinatura —
// `requireLodgeAccess(..., 'write')` ou `requireActiveSubscription(` — ou (b) estar na lista de
// isenções abaixo, com o motivo. Rota nova sem uma coisa nem outra derruba este teste, em vez
// de nascer aberta para loja sem assinatura.

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');

const EXEMPT: Record<string, string> = {
  // Login, conta própria e recuperação de senha: a loja bloqueada precisa entrar e trocar a senha.
  'account/': 'conta própria / recuperação de senha',
  'auth/': 'login',
  // Regularizar a assinatura: é justamente o que a loja bloqueada precisa conseguir fazer.
  'stripe/': 'cobrança da assinatura e webhook do Stripe',
  'signup/': 'cadastro/checkout público (ainda não há loja assinante)',
  // Sistema e plataforma: sem sessão de loja (token de plataforma/cron/assinatura de webhook).
  'cron/': 'cron (token do sistema)',
  'asaas/webhook': 'webhook do Asaas (token do sistema)',
  'backups': 'backup da plataforma (token de plataforma)',
  'invites': 'convites (token de plataforma)',
  'plataforma/': 'painel da plataforma (token de plataforma)',
  'lodges/route.ts': 'criação de loja (token de plataforma)',
  // Simulações que só leem e devolvem o que seria gravado (a gravação é o /commit, guardado).
  'import/analyze': 'simulação de importação de membros (não grava)',
  'import/financial/analyze': 'simulação de importação financeira (não grava)',
};

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? routeFiles(p) : e.name === 'route.ts' ? [p] : [];
  });
}

function handlers(src: string): { method: string; body: string }[] {
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
  const marks = [...src.matchAll(re)].map((m) => ({ method: m[1], at: m.index ?? 0 }));
  return marks.map((m, i) => ({ method: m.method, body: src.slice(m.at, marks[i + 1]?.at ?? src.length) }));
}

const DIRECT_GUARD = /requireLodgeAccess\((?:[^()]|\([^()]*\))*['"]write['"]\s*\)|requireActiveSubscription\(/;

/** Funções locais do arquivo (ex.: getSessionAndCheck) que já carregam a guarda. */
function guardedHelpers(src: string): string[] {
  const re = /(?:^|\n)(?:async\s+)?function\s+(\w+)\s*\(/g;
  const marks = [...src.matchAll(re)].map((m) => ({ name: m[1], at: m.index ?? 0 }));
  return marks
    .filter((m, i) => DIRECT_GUARD.test(src.slice(m.at, marks[i + 1]?.at ?? src.length)))
    .map((m) => m.name);
}

test('toda rota de escrita passa pela guarda de assinatura ou está isenta com motivo', () => {
  const missing: string[] = [];
  for (const file of routeFiles(API_DIR)) {
    const rel = path.relative(API_DIR, file).replace(/\\/g, '/');
    if (Object.keys(EXEMPT).some((prefix) => rel.startsWith(prefix) || rel === prefix)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const helpers = guardedHelpers(src);
    for (const h of handlers(src)) {
      if (h.method === 'GET') continue;
      const guarded = DIRECT_GUARD.test(h.body) || helpers.some((name) => h.body.includes(`${name}(`));
      if (!guarded) missing.push(`${h.method} ${rel}`);
    }
  }
  assert.deepEqual(missing, [], `Rotas de escrita sem guarda de assinatura:\n${missing.join('\n')}`);
});
