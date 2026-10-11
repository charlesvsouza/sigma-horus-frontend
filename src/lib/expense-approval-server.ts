import type { Prisma } from '@/generated/prisma/client';
import { brl } from '@/lib/currency';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';

type Db = Prisma.TransactionClient;

/** Quem lançou a despesa (registro de auditoria da criação) e o papel dele; null = não se sabe (importação etc.). */
export async function loadLauncher(db: Db, lodgeId: string, accountId: string): Promise<{ userId: string | null; role: string | null }> {
  const row = await db.auditLog.findFirst({ where: { lodgeId, entity: 'account', entityId: accountId, action: 'CREATE' }, select: { userId: true }, orderBy: { createdAt: 'asc' } });
  if (!row?.userId) return { userId: null, role: null };
  const user = await db.user.findFirst({ where: { id: row.userId, lodgeId }, select: { role: true } });
  return { userId: row.userId, role: user?.role ?? null };
}

/** Quem lançou cada despesa de uma lista (mapa contaId → userId). */
export async function loadLaunchers(db: Db, lodgeId: string, accountIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (accountIds.length === 0) return out;
  const rows = await db.auditLog.findMany({ where: { lodgeId, entity: 'account', action: 'CREATE', entityId: { in: accountIds } }, select: { entityId: true, userId: true }, orderBy: { createdAt: 'asc' } });
  for (const r of rows) if (r.userId && !out.has(r.entityId)) out.set(r.entityId, r.userId);
  return out;
}

/**
 * Avisa por e-mail os que ainda podem aprovar (Venerável, Tesoureiro, Administrador — menos quem lançou/já aprovou).
 * Devolve uma função para chamar DEPOIS da transação (falha de envio nunca desfaz a aprovação).
 */
export async function notifyApprovers(db: Db, lodgeId: string, account: { id: string; title: string; amount: number; lodgeName: string }, excludeUserIds: (string | null)[]): Promise<() => Promise<void>> {
  const users = await db.user.findMany({ where: { lodgeId, role: { in: ['venerable', 'treasurer', 'admin'] }, status: 'active' }, select: { id: true, email: true } });
  const to = [...new Set(users.filter((u) => !excludeUserIds.includes(u.id)).map((u) => u.email).filter(Boolean))];
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br').replace(/\/+$/, '');
  const subject = `Despesa aguardando a sua aprovação — ${account.lodgeName}`;
  const text = `Há uma despesa acima do limite esperando aprovação (a loja exige duas aprovações):\n\n${account.title} — ${brl(account.amount)}\n\nAbra Tesouraria → Contas e aprove:\n${appUrl}/dashboard/contas\n\n${account.lodgeName}`;
  return async () => { await Promise.all(to.map((address) => dispatch('email', address, subject, text, EMPTY_CHANNELS).catch(() => null))); };
}
