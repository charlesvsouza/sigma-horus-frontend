import type { Prisma } from '@/generated/prisma/client';
import { BRAZILIAN_POWERS, BRAZILIAN_RITES, MASONIC_CHART_OF_ACCOUNTS, OFFICES_BY_RITE } from '@/lib/masonic-reference';

/**
 * Semeia uma loja com os dados de referência da Maçonaria brasileira:
 * ritos, potências, cargos do rito escolhido e plano de contas típico.
 * Idempotente — só insere cada grupo se a loja ainda não tiver nenhum
 * registro dele (não duplica).
 *
 * @param riteName  Nome do rito escolhido no onboarding para semear
 *                  os cargos correspondentes. Se omitido, não semeia
 *                  cargos (compatibilidade retroativa).
 */
export async function seedLodgeDefaults(
  db: Prisma.TransactionClient,
  lodgeId: string,
  riteName?: string,
) {
  const [rites, powers, chart, offices] = await Promise.all([
    db.rite.count({ where: { lodgeId } }),
    db.power.count({ where: { lodgeId } }),
    db.chartAccount.count({ where: { lodgeId } }),
    db.office.count({ where: { lodgeId } }),
  ]);

  const result = { rites: 0, powers: 0, chartAccounts: 0, offices: 0 };

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

  // Semeia cargos do rito escolhido (apenas se não houver cargos ainda).
  if (offices === 0 && riteName) {
    const rite = await db.rite.findFirst({ where: { lodgeId, name: riteName } });
    if (rite) {
      const officesData = OFFICES_BY_RITE[riteName];
      if (officesData) {
        await db.office.createMany({
          data: officesData.map((o) => ({ lodgeId, riteId: rite.id, name: o.name, order: o.order })),
        });
        result.offices = officesData.length;
      }
    }
  }

  return result;
}
