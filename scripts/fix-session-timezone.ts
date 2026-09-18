/**
 * Corrige o horário de sessões gravadas ANTES da correção de fuso do
 * commit 7113a87 ("fix: foto no cadastro em edição, fuso horário de
 * sessão..."), implantado em produção em 2026-09-17T18:54:35Z.
 *
 * Antes desse deploy, POST/PATCH de /api/sessions faziam `new Date(body.date)`
 * direto sobre a string sem fuso do <input type="datetime-local"> — o servidor
 * (roda em UTC) tratava "19:30" como UTC em vez de horário de Brasília,
 * gravando o instante 3h ANTES do que a loja realmente digitou. Ex.: sessão
 * marcada para 19:30 (Brasília) ficou salva como se fosse 19:30 UTC = 16:30
 * em Brasília — exatamente o sintoma reportado.
 *
 * Toda sessão cujo `date`/`endDate` foram gravados por essa versão antiga do
 * código precisa de +3h pra corrigir. `updatedAt` é o proxy seguro pra saber
 * QUAL versão do código gravou o valor atual (toda `.update()` — inclusive um
 * PATCH feito hoje já com o fix — reseta `updatedAt`; se `updatedAt` já é
 * posterior ao deploy, o valor já está correto e NÃO deve ser tocado de novo,
 * senão desloca uma sessão que já estava certa).
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/fix-session-timezone.ts
 *
 * Para gravar de verdade:
 *   node --env-file=.env --import ./test/setup.mjs scripts/fix-session-timezone.ts \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 *
 * `updatedAt` só é um proxy seguro quando NADA além de date/endDate mexeu no
 * registro depois do bug — uma sessão só editada (agenda, presença, balaustre)
 * depois do deploy da correção fica de fora do filtro automático mesmo com
 * `date` ainda errado. Pra esses casos, liste tudo com --debug-list e corrija
 * manualmente uma sessão específica com --session-id <id>:
 *   node --env-file=.env --import ./test/setup.mjs scripts/fix-session-timezone.ts --debug-list
 *   node --env-file=.env --import ./test/setup.mjs scripts/fix-session-timezone.ts \
 *     --session-id <id> --confirm-host <trecho> --yes
 */
import { prismaAdmin } from '../src/lib/prisma';

// Não reaproveita src/lib/audit.ts (logAudit) aqui: ele importa `next/headers`,
// que só resolve dentro do runtime do Next — falha na resolução do módulo já
// ao importar, fora de uma request. Grava o AuditLog direto, mesmo formato.

const DEPLOY_CUTOFF = new Date('2026-09-17T18:54:35Z');
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function shift(d: Date | null): Date | null {
  return d ? new Date(d.getTime() + THREE_HOURS_MS) : null;
}

async function main() {
  const argv = process.argv;
  const yes = argv.includes('--yes');
  const debugList = argv.includes('--debug-list');
  const sessionIdFlagIndex = argv.indexOf('--session-id');
  const onlySessionId = sessionIdFlagIndex !== -1 ? argv[sessionIdFlagIndex + 1] : null;
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;

  if (debugList) {
    // `updatedAt` bumpa em QUALQUER alteração do registro (agenda, presença,
    // balaustre) — não só quando `date`/`endDate` são reescritos. Uma sessão
    // criada com o bug e só editada depois do deploy (updatedAt recente) passa
    // batido pelo filtro automático abaixo. --debug-list lista todas, sem
    // filtro, pra inspeção manual antes de decidir usar --session-id.
    const all = await prismaAdmin.session.findMany({
      select: { id: true, lodgeId: true, title: true, date: true, endDate: true, createdAt: true, updatedAt: true },
      orderBy: { date: 'asc' },
    });
    console.log(`Total de sessões no banco: ${all.length}\n`);
    for (const s of all) {
      console.log(
        `  [${s.id}] lodge=${s.lodgeId} "${s.title}"\n` +
        `    date:      ${s.date.toISOString()}\n` +
        `    endDate:   ${s.endDate?.toISOString() ?? '—'}\n` +
        `    createdAt: ${s.createdAt.toISOString()}\n` +
        `    updatedAt: ${s.updatedAt.toISOString()}\n`,
      );
    }
    return;
  }

  const affected = onlySessionId
    ? await prismaAdmin.session.findMany({
        where: { id: onlySessionId },
        select: { id: true, lodgeId: true, title: true, date: true, endDate: true, updatedAt: true },
      })
    : await prismaAdmin.session.findMany({
        where: { updatedAt: { lt: DEPLOY_CUTOFF } },
        select: { id: true, lodgeId: true, title: true, date: true, endDate: true, updatedAt: true },
        orderBy: { date: 'asc' },
      });

  console.log(
    onlySessionId
      ? `Sessão selecionada manualmente (--session-id): ${affected.length}\n`
      : `Sessões gravadas antes do deploy da correção (${DEPLOY_CUTOFF.toISOString()}): ${affected.length}\n`,
  );

  for (const s of affected) {
    const newDate = shift(s.date);
    const newEndDate = shift(s.endDate);
    console.log(
      `  [${s.lodgeId}] "${s.title}"\n` +
      `    date:    ${s.date.toISOString()} → ${newDate!.toISOString()}\n` +
      (s.endDate ? `    endDate: ${s.endDate.toISOString()} → ${newEndDate!.toISOString()}\n` : ''),
    );
  }

  if (affected.length === 0) {
    console.log('Nada a corrigir.');
    return;
  }

  if (!yes) {
    console.log('[SIMULAÇÃO] Nada foi gravado. Rode de novo com --confirm-host <trecho> --yes para gravar.');
    return;
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!confirmHost || !dbUrl.includes(confirmHost)) {
    console.error('\n[RECUSADO] --confirm-host não bate com o DATABASE_URL atual.');
    process.exitCode = 1;
    return;
  }

  // Usuário pra atribuir no log de auditoria: o admin mais antigo de cada loja
  // (script roda fora de uma sessão HTTP, não há um "quem fez login" real).
  const adminByLodge = new Map<string, string>();

  let updated = 0;
  for (const s of affected) {
    const newDate = shift(s.date)!;
    const newEndDate = shift(s.endDate);

    if (!adminByLodge.has(s.lodgeId)) {
      const admin = await prismaAdmin.user.findFirst({ where: { lodgeId: s.lodgeId, role: 'admin' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      adminByLodge.set(s.lodgeId, admin?.id ?? '');
    }
    const userId = adminByLodge.get(s.lodgeId) || 'system:fix-session-timezone';

    await prismaAdmin.$transaction(async (tx) => {
      await tx.session.update({ where: { id: s.id }, data: { date: newDate, endDate: newEndDate } });
      await tx.auditLog.create({
        data: {
          lodgeId: s.lodgeId,
          userId: userId || null,
          action: 'UPDATE',
          entity: 'session',
          entityId: s.id,
          before: JSON.stringify({ date: s.date.toISOString(), endDate: s.endDate?.toISOString() ?? null }),
          after: JSON.stringify({ reason: 'fix-timezone-2026-09-17', date: newDate.toISOString(), endDate: newEndDate?.toISOString() ?? null }),
        },
      });
    });
    updated++;
  }

  console.log(`\nConcluído: ${updated} sessão(ões) corrigida(s).`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
