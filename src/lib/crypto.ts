import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Deriva uma chave AES-256 (32 bytes) a partir do AUTH_SECRET (já existe em prod),
// evitando exigir um novo secret. Se um dia precisar rotacionar, troque para
// uma env dedicada (ex.: ENCRYPTION_KEY) e versione o prefixo abaixo.
function getKey() {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY/AUTH_SECRET ausente — não é possível criptografar segredos.');
  }
  return createHash('sha256').update(secret).digest();
}

/** Criptografa um texto (AES-256-GCM). Formato: `v1:<iv>:<tag>:<ciphertext>` (base64). */
export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/** Descriptografa um valor gerado por encryptSecret. Retorna null se o formato for inválido. */
export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;

  try {
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const ciphertext = Buffer.from(parts[3], 'base64');
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Mostra só os últimos 4 caracteres de um segredo (para status na UI). */
export function maskSecret(plaintext: string) {
  if (plaintext.length <= 4) return '••••';
  return `••••${plaintext.slice(-4)}`;
}
