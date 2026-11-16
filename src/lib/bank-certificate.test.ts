import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { certificateHealth, certificateMatchesKey, inspectCertificate, shouldAlertCertificate } from './bank-certificate.ts';

const DAY = 24 * 60 * 60 * 1000;

/** Gera um certificado de teste na hora com o openssl (nada de chave fixa no repositório). Null se não houver openssl. */
function makeCert(days: number, cn: string): { crt: string; key: string } | null {
  const dir = mkdtempSync(join(tmpdir(), 'cert-test-'));
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem'), '-days', String(days), '-subj', `/CN=${cn}/O=Teste/C=BR`], { stdio: 'ignore' });
    return { crt: readFileSync(join(dir, 'c.pem'), 'utf8'), key: readFileSync(join(dir, 'k.pem'), 'utf8') };
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const fixture = makeCert(10, 'cliente-123');
const other = makeCert(10, 'outro');

test('lê validade e CN do certificado', { skip: !fixture && 'sem openssl' }, () => {
  const info = inspectCertificate(fixture!.crt);
  assert.equal(info.commonName, 'cliente-123');
  const left = Math.round((info.notAfter.getTime() - Date.now()) / DAY);
  assert.ok(left >= 9 && left <= 10, `esperava ~10 dias, veio ${left}`);
});

test('chave do certificado confere; par trocado ou lixo não', { skip: !fixture && 'sem openssl' }, () => {
  assert.equal(certificateMatchesKey(fixture!.crt, fixture!.key), true);
  assert.equal(certificateMatchesKey(fixture!.crt, other!.key), false);
  assert.equal(certificateMatchesKey('lixo', 'lixo'), false);
});

test('saúde do certificado: ok, janela de renovação e vencido', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const em = (d: number) => new Date(now.getTime() + d * DAY);
  assert.equal(certificateHealth(em(200), now).status, 'ok');
  assert.equal(certificateHealth(em(31), now).status, 'ok');
  assert.equal(certificateHealth(em(30), now).status, 'renew');
  assert.equal(certificateHealth(em(1), now).status, 'renew');
  const vencido = certificateHealth(em(-2), now);
  assert.equal(vencido.status, 'expired');
  assert.equal(vencido.daysLeft, -2);
  // a renovação abre 30 dias antes do vencimento
  assert.equal(certificateHealth(em(100), now).renewFrom.getTime(), em(70).getTime());
});

test('aviso ao Tesoureiro: só na janela final, no máximo 1 por semana', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const em = (d: number) => new Date(now.getTime() + d * DAY);
  assert.equal(shouldAlertCertificate(em(90), null, now), false);
  assert.equal(shouldAlertCertificate(em(20), null, now), true);
  assert.equal(shouldAlertCertificate(em(20), new Date(now.getTime() - 3 * DAY), now), false);
  assert.equal(shouldAlertCertificate(em(20), new Date(now.getTime() - 7 * DAY), now), true);
  assert.equal(shouldAlertCertificate(em(-1), null, now), true);
});
