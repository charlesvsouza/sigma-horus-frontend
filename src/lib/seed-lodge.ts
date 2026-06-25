import type { Prisma } from '@/generated/prisma/client';
import { BRAZILIAN_POWERS, BRAZILIAN_RITES, MASONIC_CHART_OF_ACCOUNTS } from '@/lib/masonic-reference';

/**
 * Semeia uma loja com os dados de referência da Maçonaria brasileira:
 * ritos, potências e plano de contas típico. Idempotente — só insere cada
 * grupo se a loja ainda não tiver nenhum registro dele (não duplica).
 *
 * Recebe um client de transação (`db`) para rodar tanto no onboarding
 * (prismaAdmin) quanto via `withTenant` (role de tenant, sob RLS).
 */
export async function seedLodgeDefaults(db: Prisma.TransactionClient, lodgeId: string) {
  const [rites, powers, chart] = await Promise.all([
    db.rite.count({ where: { lodgeId } }),
    db.power.count({ where: { lodgeId } }),
    db.chartAccount.count({ where: { lodgeId } }),
  ]);

  const result = { rites: 0, powers: 0, chartAccounts: 0 };

  if (rites === 0) {
    await db.rite.createMany({ data: BRAZILIAN_RITES.map((r) => ({ lodgeId, name: r.name, order: r.order })) });
    result.rites = BRAZILIAN_RITES.length;
  }

  if (powers === 0) {
    await db.power.createMany({ data: BRAZILIAN_POWERS.map((p) => ({ lodgeId, name: p.name, order: p.order })) });
    result.powers = BRAZILIAN_POWERS.length;
  }

  if (chart === 0) {
    await db.chartAccount.createMany({
      data: MASONIC_CHART_OF_ACCOUNTS.map((c) => ({ lodgeId, code: c.code, name: c.name, type: c.type, category: c.category })),
    });
    result.chartAccounts = MASONIC_CHART_OF_ACCOUNTS.length;
  }

  return result;
}
