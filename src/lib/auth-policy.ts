// Regras de acesso puras (sem banco) usadas por auth.ts — isoladas para teste.

/** Tentativas de senha erradas toleradas por conta na janela abaixo. */
export const LOGIN_MAX_FAILURES = 8;
export const LOGIN_WINDOW_MS = 15 * 60_000;
/** Tentativas de login que falham por IP na mesma janela (pega quem testa muitas contas/e-mails). */
export const LOGIN_IP_MAX_FAILURES = 30;
/** Entrada de superadmin com o token da plataforma: bem mais estrita — um acerto abre qualquer loja. */
export const IMPERSONATE_IP_MAX_FAILURES = 5;
/** Quanto tempo o resultado da revalidação do usuário (status/papel) fica em cache por instância. */
export const SESSION_REVALIDATE_TTL_MS = 30_000;

/** Usuário ativo, de uma loja ativa (loja encerrada/expurgada não acessa). */
export function isAccountUsable(user: { status: string } | null | undefined, lodge: { status: string } | null | undefined): boolean {
  return Boolean(user && lodge && user.status === 'active' && lodge.status === 'active');
}

export function isLockedOut(recentFailures: number): boolean {
  return recentFailures >= LOGIN_MAX_FAILURES;
}
