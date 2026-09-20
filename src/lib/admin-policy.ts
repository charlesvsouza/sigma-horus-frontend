// Regras do papel de Administrador — funções puras (testáveis) + duas consultas.
//
// Princípios (decisão do dono da plataforma, 2026-09-20):
//  1. O papel de Administrador é FIXO: ninguém é promovido a Administrador e o
//     Administrador também não é rebaixado. Quem precisa de outro papel ganha
//     outro usuário, com outro e-mail.
//  2. Só o Administrador cria outro Administrador, no máximo MAX_ADMINS ativos.
//  3. Um e-mail, um papel: o e-mail de login do Administrador nunca é o e-mail
//     de cadastro de um obreiro da mesma loja (e vice-versa) — papéis não se
//     confundem, mesmo quando a pessoa é as duas coisas.

import { prismaAdmin } from '@/lib/prisma';

export const MAX_ADMINS = 2;

export const ADMIN_EMAIL_ADVICE =
  'Se você também é membro, use um e-mail diferente para o Administrador: os papéis não se confundem.';

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/** Mudança de papel permitida? (Administrador é fixo nos dois sentidos.) */
export function checkRoleChange(currentRole: string, newRole: string): { ok: true } | { ok: false; error: string } {
  if (currentRole === newRole) return { ok: true };
  if (newRole === 'admin') {
    return { ok: false, error: 'Ninguém é promovido a Administrador. Para ter outro Administrador, crie um novo com "Novo administrador" — com um e-mail próprio.' };
  }
  if (currentRole === 'admin') {
    return { ok: false, error: 'O papel de Administrador é fixo e não pode ser rebaixado. Crie outro usuário para a função desejada, com outro e-mail.' };
  }
  return { ok: true };
}

/** Cabe mais um Administrador ativo? */
export function checkAdminCap(activeAdmins: number): { ok: true } | { ok: false; error: string } {
  if (activeAdmins >= MAX_ADMINS) {
    return { ok: false, error: `Cada loja pode ter no máximo ${MAX_ADMINS} Administradores ativos. Desative um antes de criar ou reativar outro.` };
  }
  return { ok: true };
}

export function adminEmailIsMemberMessage(): string {
  return `Este e-mail já é de um membro desta loja. ${ADMIN_EMAIL_ADVICE}`;
}

export function memberEmailIsAdminMessage(): string {
  return `Este e-mail é o do Administrador da loja. Use outro e-mail para o cadastro do obreiro: os papéis não se confundem.`;
}

/** Algum membro da loja usa este e-mail no cadastro? */
export async function memberUsesEmail(lodgeId: string, email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e) return false;
  return (await prismaAdmin.member.count({ where: { lodgeId, email: { equals: e, mode: 'insensitive' } } })) > 0;
}

/** E-mails (minúsculos) dos Administradores da loja. */
export async function adminEmails(lodgeId: string): Promise<string[]> {
  const rows = await prismaAdmin.user.findMany({ where: { lodgeId, role: 'admin' }, select: { email: true } });
  return rows.map((r) => normalizeEmail(r.email));
}

export async function activeAdminCount(lodgeId: string): Promise<number> {
  return prismaAdmin.user.count({ where: { lodgeId, role: 'admin', status: 'active' } });
}
