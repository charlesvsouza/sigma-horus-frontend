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
  const [rites, powers, offices, existingChart] = await Promise.all([
    db.rite.count({ where: { lodgeId } }),
    db.power.count({ where: { lodgeId } }),
    db.office.count({ where: { lodgeId } }),
    db.chartAccount.findMany({ where: { lodgeId }, select: { code: true } }),
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

  // Plano de contas: top-up não-destrutivo — adiciona apenas os códigos que
  // ainda não existem (não duplica nem remove contas já cadastradas).
  const haveChartCodes = new Set(existingChart.map((c) => c.code));
  const missingChart = MASONIC_CHART_OF_ACCOUNTS.filter((c) => !haveChartCodes.has(c.code));
  if (missingChart.length > 0) {
    await db.chartAccount.createMany({
      data: missingChart.map((c) => ({ lodgeId, code: c.code, name: c.name, type: c.type, category: c.category, isSolidarity: c.solidarity ?? false })),
    });
    result.chartAccounts = missingChart.length;
  }

  // Atualiza isSolidarity nas contas existentes que estão no padrão canônico.
  for (const c of MASONIC_CHART_OF_ACCOUNTS) {
    if (c.solidarity && haveChartCodes.has(c.code)) {
      await db.chartAccount.updateMany({ where: { lodgeId, code: c.code, isSolidarity: { not: true } }, data: { isSolidarity: true } });
    }
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

/**
 * Sincroniza o plano de contas da loja com o padrão canônico (AMORIO):
 * - adiciona as contas canônicas que faltam (por código);
 * - remove contas DEFAULT antigas (código fora do canônico) que NÃO estejam
 *   vinculadas a nenhuma conta a pagar/receber — limpa resíduos de versões
 *   anteriores da codificação (ex.: 1.01..1.11) sem perder histórico.
 * Contas customizadas/vinculadas são preservadas.
 */
export async function syncChartAccounts(
  db: Prisma.TransactionClient,
  lodgeId: string,
): Promise<{ added: number; removed: number; kept: number }> {
  const canonicalCodes = new Set(MASONIC_CHART_OF_ACCOUNTS.map((c) => c.code));
  const current = await db.chartAccount.findMany({ where: { lodgeId }, select: { id: true, code: true } });

  // Contas do plano que estão em uso (vinculadas a algum Account) — não remover.
  const refs = await db.account.findMany({
    where: { lodgeId, chartAccountId: { not: null } },
    select: { chartAccountId: true },
  });
  const referenced = new Set(refs.map((r) => r.chartAccountId));

  const toRemove = current.filter((c) => !canonicalCodes.has(c.code) && !referenced.has(c.id));
  if (toRemove.length > 0) {
    await db.chartAccount.deleteMany({ where: { id: { in: toRemove.map((c) => c.id) } } });
  }

  const haveCodes = new Set(current.map((c) => c.code));
  const toAdd = MASONIC_CHART_OF_ACCOUNTS.filter((c) => !haveCodes.has(c.code));
  if (toAdd.length > 0) {
    await db.chartAccount.createMany({
      data: toAdd.map((c) => ({ lodgeId, code: c.code, name: c.name, type: c.type, category: c.category, isSolidarity: c.solidarity ?? false })),
    });
  }

  // Atualiza isSolidarity nas contas existentes que estão no padrão canônico,
  // para corrigir registros criados antes do campo existir (ex.: Tronco).
  for (const c of MASONIC_CHART_OF_ACCOUNTS) {
    if (c.solidarity && haveCodes.has(c.code)) {
      await db.chartAccount.updateMany({ where: { lodgeId, code: c.code, isSolidarity: { not: true } }, data: { isSolidarity: true } });
    }
  }

  return { added: toAdd.length, removed: toRemove.length, kept: current.length - toRemove.length };
}

/**
 * Semeia (ou completa) os cargos de um rito específico para uma loja já
 * existente. NÃO apaga cargos: apenas adiciona os que faltam (idempotente,
 * dedupe por nome dentro da loja). Cria o registro do Rito se ele não existir.
 *
 * Usado quando o administrador define/troca o rito nas Configurações da loja.
 */
export async function seedOfficesForRite(
  db: Prisma.TransactionClient,
  lodgeId: string,
  riteName: string,
): Promise<{ created: number; skipped: number; rite: string }> {
  const officesData = OFFICES_BY_RITE[riteName];
  if (!officesData) return { created: 0, skipped: 0, rite: riteName };

  let rite = await db.rite.findFirst({ where: { lodgeId, name: riteName } });
  if (!rite) {
    const order = BRAZILIAN_RITES.find((r) => r.name === riteName)?.order ?? 99;
    rite = await db.rite.create({ data: { lodgeId, name: riteName, order } });
  }

  const existing = await db.office.findMany({ where: { lodgeId }, select: { name: true } });
  const have = new Set(existing.map((o) => o.name.trim().toLowerCase()));
  const toCreate = officesData.filter((o) => !have.has(o.name.trim().toLowerCase()));

  if (toCreate.length > 0) {
    await db.office.createMany({
      data: toCreate.map((o) => ({ lodgeId, riteId: rite.id, name: o.name, order: o.order })),
    });
  }

  return { created: toCreate.length, skipped: officesData.length - toCreate.length, rite: riteName };
}
