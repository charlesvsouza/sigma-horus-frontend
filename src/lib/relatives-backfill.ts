import type { Prisma } from '@/generated/prisma/client';

// Migra os campos planos antigos (motherName/fatherName/spouseName/childrenNames)
// para a tabela relacional Relative. Idempotente: só processa membros que ainda
// não têm nenhum familiar cadastrado, para não duplicar nem sobrescrever dados
// já inseridos pela nova UI. Extraído de api/members/backfill-relatives para ser
// reusado também pelo commit do import wizard (que grava família nos campos
// planos e normaliza em seguida, no mesmo fluxo).
export async function backfillMemberRelatives(db: Prisma.TransactionClient, lodgeId: string) {
  const stats = { processed: 0, migrated: 0, relativesCreated: 0, skipped: 0 };

  const members = await db.member.findMany({
    where: { lodgeId },
    select: {
      id: true, motherName: true, fatherName: true, spouseName: true,
      spouseBirthDate: true, childrenNames: true,
      _count: { select: { relatives: true } },
    },
  });

  for (const m of members) {
    stats.processed++;
    if (m._count.relatives > 0) { stats.skipped++; continue; }

    const rows: { kind: string; name: string; birthDate?: Date | null; order: number }[] = [];
    if (m.motherName?.trim()) rows.push({ kind: 'mother', name: m.motherName.trim(), order: 0 });
    if (m.fatherName?.trim()) rows.push({ kind: 'father', name: m.fatherName.trim(), order: 1 });
    if (m.spouseName?.trim()) rows.push({ kind: 'spouse', name: m.spouseName.trim(), birthDate: m.spouseBirthDate, order: 2 });
    // childrenNames era texto livre — separa por vírgula, ponto-e-vírgula ou quebra de linha.
    const children = (m.childrenNames ?? '')
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    children.forEach((name, i) => rows.push({ kind: 'child', name, order: 10 + i }));

    if (rows.length === 0) { stats.skipped++; continue; }

    await db.relative.createMany({
      data: rows.map((r) => ({ lodgeId, memberId: m.id, ...r })),
    });
    stats.migrated++;
    stats.relativesCreated += rows.length;
  }

  return stats;
}
