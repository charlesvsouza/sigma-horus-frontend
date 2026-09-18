import { createHmac, timingSafeEqual } from 'node:crypto';

// Link de redefinição de senha SEM estado no banco: o token é
// base64url({u: userId, e: expiraEm}) + "." + HMAC-SHA256(AUTH_SECRET, payload + passwordHash).
// Como o HMAC inclui o hash da senha atual, o link deixa de valer assim que a
// senha muda (uso único) e também expira sozinho (1h).

export const RESET_TOKEN_TTL_MS = 60 * 60_000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET ausente');
  return s;
}

function mac(payload: string, passwordHash: string): string {
  return createHmac('sha256', secret()).update(`${payload}.${passwordHash}`).digest('base64url');
}

export function signResetToken(userId: string, passwordHash: string, now: number = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: now + RESET_TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${mac(payload, passwordHash)}`;
}

/** Lê o id do usuário do token (sem validar) — para saber qual hash de senha usar na verificação. */
export function readResetTokenUser(token: string): string | null {
  try {
    const [payload] = token.split('.');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data?.u === 'string' ? data.u : null;
  } catch {
    return null;
  }
}

export function verifyResetToken(token: string, passwordHash: string, now: number = Date.now()): boolean {
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
