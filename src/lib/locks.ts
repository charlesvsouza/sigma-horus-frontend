import type { Prisma } from '@/generated/prisma/client';

/**
 * Serializa transações concorrentes sobre a mesma chave (trava consultiva do Postgres,
 * liberada sozinha ao fim da transação). Serve para os padrões "conferir e depois gravar"
 * — saldo em aberto antes de baixar, próximo número de cobrança, webhook repetido — que,
 * sem a trava, deixam dois cliques/requisições simultâneos passarem juntos pela conferência.
 * Depois de obter a trava, as consultas seguintes já enxergam o que a outra transação gravou.
 */
export async function lockKey(db: Prisma.TransactionClient, key: string): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
