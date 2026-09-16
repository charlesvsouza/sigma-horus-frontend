/**
 * Concede acesso ao sistema (User com senha provisória por e-mail) a TODOS os
 * membros de uma loja que ainda não têm login (`member.user === null`).
 * Mesma lógica do botão "Conceder acesso" (api/members/[id]/grant-access),
 * só que em lote — reaproveita `generateTempPassword`/`dispatch`.
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/bulk-grant-access.ts <lodgeId>
 *
 * Para gravar de verdade (cria os Users e ENVIA os e-mails de verdade):
 *   node --env-file=.env --import ./test/setup.mjs scripts/bulk-grant-access.ts <lodgeId> \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 *
 * Para excluir membros específicos do disparo (ex.: e-mail suspeito a corrigir depois),
 * passe --skip-email <e-mail1,e-mail2,...> (case-insensitive).
 */
import bcrypt from 'bcryptjs';
import { prismaAdmin } from '../src/lib/prisma';
import { generateTempPassword } from '../src/lib/password';
import { dispatch, EMPTY_CHANNELS } from '../src/lib/messaging';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br';

function buildEmail(name: string, email: string, tempPassword: string) {
  const subject = 'Seu acesso ao Sigma Horus';
  const body = [
    `Prezado Ir∴ ${name},`,
    '',
    'Seu acesso ao sistema da loja foi liberado.',
    '',
    `Endereço: ${APP_URL}/login`,
    `Usuário (e-mail): ${email}`,
    `Senha provisória: ${tempPassword}`,
    '',
    'Por segurança, você deverá definir uma nova senha no primeiro acesso.',
    '',
    'T∴F∴A∴',
  ].join('\n');
  return { subject, body };
}

async function main() {
  const argv = process.argv;
  const lodgeId = argv[2];
  const yes = argv.includes('--yes');
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;
  const skipFlagIndex = argv.indexOf('--skip-email');
  const skipEmails = new Set(
    (skipFlagIndex !== -1 ? argv[skipFlagIndex + 1] : '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );

  if (!lodgeId) {
    console.error('Uso: bulk-grant-access.ts <lodgeId> [--skip-email <e1,e2>] [--confirm-host <trecho>] [--yes]');
    process.exitCode = 1;
    return;
  }

  const candidates = await prismaAdmin.member.findMany({
    where: { lodgeId, user: null },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });

  const noEmail = candidates.filter((m) => !(m.email || '').trim());
  const skipped = candidates.filter((m) => (m.email || '').trim() && skipEmails.has(m.email!.trim().toLowerCase()));
  const withEmail = candidates.filter((m) => (m.email || '').trim() && !skipEmails.has(m.email!.trim().toLowerCase()));

  console.log(`Loja: ${lodgeId}`);
  console.log(`Membros sem acesso: ${candidates.length}`);
  console.log(`  com e-mail cadastrado (elegíveis): ${withEmail.length}`);
  console.log(`  sem e-mail (ficam de fora, precisam cadastrar e-mail antes): ${noEmail.length}`);
  console.log(`  excluídos via --skip-email: ${skipped.length}`);
  if (noEmail.length) {
    console.log('\nSem e-mail:');
    for (const m of noEmail) console.log(`  - ${m.name}`);
  }
  if (skipped.length) {
    console.log('\nExcluídos (--skip-email):');
    for (const m of skipped) console.log(`  - ${m.name} <${m.email}>`);
  }
  console.log('\nElegíveis:');
  for (const m of withEmail) console.log(`  - ${m.name} <${m.email}>`);

  if (!yes) {
    console.log('\n[SIMULAÇÃO] Nada foi gravado e nenhum e-mail foi enviado.');
    console.log('Rode de novo com --confirm-host <trecho> --yes para conceder acesso de verdade.');
    return;
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!confirmHost || !dbUrl.includes(confirmHost)) {
    console.error('\n[RECUSADO] --confirm-host não bate com o DATABASE_URL atual.');
    process.exitCode = 1;
    return;
  }

  const stats = { created: 0, relinked: 0, sent: 0, queued: 0, failed: 0, skipped: 0 };

  for (const member of withEmail) {
    const email = (member.email || '').trim().toLowerCase();

    const emailOwner = await prismaAdmin.user.findUnique({
      where: { email },
      select: { id: true, memberId: true, lodgeId: true },
    });
    if (emailOwner && emailOwner.lodgeId !== lodgeId) {
      console.log(`[SKIP] ${member.name}: e-mail já pertence a um usuário de outra loja.`);
      stats.skipped++;
      continue;
    }
    if (emailOwner && emailOwner.memberId && emailOwner.memberId !== member.id) {
      console.log(`[SKIP] ${member.name}: e-mail já pertence a outro usuário.`);
      stats.skipped++;
      continue;
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    if (emailOwner) {
      await prismaAdmin.user.update({
        where: { id: emailOwner.id },
        data: { memberId: member.id, passwordHash, mustChangePassword: true, status: 'active' },
      });
      stats.relinked++;
    } else {
      await prismaAdmin.user.create({
        data: {
          name: member.name,
          email,
          passwordHash,
          role: 'member',
          lodgeId,
          memberId: member.id,
          mustChangePassword: true,
        },
      });
      stats.created++;
    }

    const { subject, body } = buildEmail(member.name, email, tempPassword);
    const result = await dispatch('email', email, subject, body, EMPTY_CHANNELS);
    if (result.status === 'sent') stats.sent++;
    else if (result.status === 'queued') stats.queued++;
    else stats.failed++;

    await prismaAdmin.messageLog.create({
      data: {
        lodgeId,
        memberId: member.id,
        channel: 'email',
        title: subject,
        content: 'Senha provisória de acesso (conteúdo omitido).',
        status: result.status,
      },
    });

    console.log(`[OK] ${member.name} <${email}> — e-mail: ${result.status}${result.detail ? ` (${result.detail})` : ''}`);
  }

  await prismaAdmin.auditLog.create({
    data: {
      lodgeId,
      action: 'CREATE',
      entity: 'user',
      entityId: 'bulk-grant-access',
      after: JSON.stringify({ ...stats, total: withEmail.length, script: 'bulk-grant-access.ts' }),
    },
  });

  console.log('\nConcluído:', stats);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
