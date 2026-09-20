import { createHmac, timingSafeEqual } from 'node:crypto';

// Link de confirmação de troca de e-mail, SEM estado no banco (mesmo desenho do reset-token):
// base64url({u: userId, n: novoEmail, e: expiraEm}) + "." + HMAC-SHA256(AUTH_SECRET, payload + passwordHash).
// O HMAC inclui o hash da senha atual: trocar a senha invalida o link pendente; expira em 1h.

export const EMAIL_CHANGE_TTL_MS = 60 * 60_000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET ausente');
  return s;
}

function mac(payload: string, passwordHash: string): string {
  return createHmac('sha256', secret()).update(`email-change.${payload}.${passwordHash}`).digest('base64url');
}

export function signEmailChangeToken(userId: string, newEmail: string, passwordHash: string, now: number = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, n: newEmail.trim().toLowerCase(), e: now + EMAIL_CHANGE_TTL_MS })).toString('base64url');
  return `${payload}.${mac(payload, passwordHash)}`;
}

export function readEmailChangeToken(token: string): { userId: string; newEmail: string } | null {
  try {
    const [payload] = token.split('.');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data?.u === 'string' && typeof data?.n === 'string' ? { userId: data.u, newEmail: data.n } : null;
  } catch {
    return null;
  }
}

export function verifyEmailChangeToken(token: string, passwordHash: string, now: number = Date.now()): boolean {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data?.e !== 'number' || now > data.e) return false;
    const expected = Buffer.from(mac(payload, passwordHash));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}
