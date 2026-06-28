// Geração de senha provisória legível (sem caracteres ambíguos) para o 1º acesso
// do obreiro. A senha é enviada por e-mail e deve ser trocada no primeiro login
// (User.mustChangePassword). Não armazenamos a senha em claro — só o hash bcrypt.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I, O
const DIGITS = '23456789'; // sem 0, 1
const LOWER = 'abcdefghijkmnpqrstuvwxyz'; // sem l, o

function pick(set: string, n: number): string {
  let out = '';
  for (let i = 0; i < n; i++) out += set[Math.floor(Math.random() * set.length)];
  return out;
}

/** Ex.: "Krp7-tn4Q" — fácil de digitar, com maiúscula, minúscula e dígitos. */
export function generateTempPassword(): string {
  return `${pick(ALPHABET, 1)}${pick(LOWER, 3)}${pick(DIGITS, 1)}-${pick(LOWER, 2)}${pick(DIGITS, 1)}${pick(ALPHABET, 1)}`;
}

/** Validação mínima de senha definida pelo usuário. */
export function isStrongEnough(pw: string): boolean {
  return typeof pw === 'string' && pw.length >= 8;
}
