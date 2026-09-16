/**
 * CORREÇÃO PONTUAL: os 31 Users criados por `bulk-grant-access.ts` na loja
 * AMM139 (2026-09-15) foram gravados com senha provisória, mas o e-mail NÃO
 * foi enviado (RESEND_API_KEY/RESEND_FROM ausentes no ambiente local) — a
 * senha em texto puro já se perdeu (só ficou o hash bcrypt no banco).
 *
 * Este script gera uma NOVA senha provisória para cada um desses usuários
 * (mustChangePassword=true) e envia por e-mail de verdade (Resend).
 * Precisa rodar com RESEND_API_KEY e RESEND_FROM disponíveis no ambiente
 * (ex.: puxados da Vercel produção).
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/fix-bulk-grant-access-emails.ts <lodgeId>
 *
 * Para gravar de verdade (reseta a senha e ENVIA o e-mail de verdade):
 *   node --env-file=.env --import ./test/setup.mjs scripts/fix-bulk-grant-access-emails.ts <lodgeId> \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 */
import bcrypt from 'bcryptjs';
import { prismaAdmin } from '../src/lib/prisma';
import { generateTempPassword } from '../src/lib/password';
import { dispatch, EMPTY_CHANNELS } from '../src/lib/messaging';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br';

// Lista EXATA dos 31 e-mails afetados pelo disparo original (bulk-grant-access.ts,
// 2026-09-15, AMM139) que ficaram "queued". Fixa de propósito — não usar um filtro
// genérico por mustChangePassword=true, que pegaria resets de senha de outros
// usuários sem relação com este incidente.
const AFFECTED_EMAILS = [
  'almir73510@gmail.com',
  'aalzemar@gmail.com',
  'figueiraac@gmail.com',
  'augusto.masini@gmail.com',
  'dr.costanza@gmail.com',
  'docchagas@gmail.com',
  'eurosodre10@gmail.com',
  'cristiano.sa@gmail.com',
  'profdag@gmail.com',
  'edmilsonganastacio3@gmail.com',
  'evaldoalbuquerque11@hotmail.com',
  'peixotogr@gmail.com',
  'heiderdarlon@gmail.com',
  'jorgebragajr@gmail.com',
  'judsondsilva@hotmail.com',
  'jcsbonfimrj@gmail.com',
  'moraes.leandro@hotmail.com',
  'leandrorodrigotavares@hotmail.com',
  'leonardo.grivot@hotmail.com',
  'lucianoreynaldo@gmail.com',
  'luispassos.silva@gmail.com',
  'andrade.familia1998@gmail.com',
  'muniz20@gmail.com',
  'barbosa.ms@gmail.com',
  'dr.marcelosilvaadvogado@gmail.com',
  'marciodequeiroz@icloud.com',
  'marcus.soares.adv@gmail.com',
  'maxwell@adv.oabrj.org.br',
  'renatoalvesdossantos@gmail.com',
  'rsalgadosbr@gmail.com',
  'yuribako.r@gmail.com',
];

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

  if (!lodgeId) {
    console.error('Uso: fix-bulk-grant-access-emails.ts <lodgeId> [--confirm-host <trecho>] [--yes]');
    process.exitCode = 1;
    return;
  }

  if (!yes && !(process.env.RESEND_API_KEY && process.env.RESEND_FROM)) {
    console.log('[AVISO] RESEND_API_KEY/RESEND_FROM não estão no ambiente — em modo --yes os e-mails ficariam "queued" de novo.');
  }

  const targets = await prismaAdmin.user.findMany({
    where: { lodgeId, email: { in: AFFECTED_EMAILS }, mustChangePassword: true },
    select: { id: true, name: true, email: true, memberId: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Loja: ${lodgeId}`);
  console.log(`Usuários com senha provisória pendente (mustChangePassword=true): ${targets.length}`);
  for (const u of targets) console.log(`  - ${u.name} <${u.email}>`);

  if (!yes) {
    console.log('\n[SIMULAÇÃO] Nada foi gravado e nenhum e-mail foi enviado.');
    console.log('Rode de novo com --confirm-host <trecho> --yes para reenviar de verdade.');
    return;
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!confirmHost || !dbUrl.includes(confirmHost)) {
    console.error('\n[RECUSADO] --confirm-host não bate com o DATABASE_URL atual.');
    process.exitCode = 1;
    return;
  }

  const stats = { reset: 0, sent: 0, queued: 0, failed: 0 };
  const failedPasswords: { name: string; email: string; tempPassword: string }[] = [];

  for (let i = 0; i < targets.length; i++) {
    const u = targets[i];
    const tempPassword = generateTempPassword();

    const { subject, body } = buildEmail(u.name, u.email, tempPassword);
    const result = await dispatch('email', u.email, subject, body, EMPTY_CHANNELS);

    // Só grava a NOVA senha se ela tiver como chegar ao dono (enviada, ou pelo
    // menos capturada aqui em texto pra repasse manual) — nunca troca a senha
    // e deixa o resultado se perder de novo.
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await prismaAdmin.user.update({
      where: { id: u.id },
      data: { passwordHash, mustChangePassword: true },
    });
    stats.reset++;

    if (result.status === 'sent') stats.sent++;
    else if (result.status === 'queued') stats.queued++;
    else { stats.failed++; failedPasswords.push({ name: u.name, email: u.email, tempPassword }); }

    await prismaAdmin.messageLog.create({
      data: {
        lodgeId,
        memberId: u.memberId,
        channel: 'email',
        title: subject,
        content: 'Senha provisória de acesso (conteúdo omitido) — reenvio de correção.',
        status: result.status,
      },
    });

    console.log(`[OK] ${u.name} <${u.email}> — e-mail: ${result.status}${result.detail ? ` (${result.detail})` : ''}${result.status !== 'sent' ? ` — SENHA: ${tempPassword}` : ''}`);

    // Se o e-mail falhar logo no primeiro, aborta o resto do lote em vez de
    // continuar resetando senha de todo mundo com o mesmo problema (ex.: chave
    // do Resend errada) — corrija e rode de novo só para quem falhou.
    if (i === 0 && result.status === 'failed') {
      console.error('\n[ABORTADO] O primeiro envio falhou — corrija RESEND_API_KEY/RESEND_FROM antes de continuar.');
      console.error(`Anote a senha acima para ${u.name} antes de seguir; os demais (${targets.length - 1}) NÃO foram tocados.`);
      break;
    }
  }

  if (failedPasswords.length) {
    console.log('\n⚠️  Senhas de quem falhou o envio (repasse manual, NÃO ficam salvas em lugar nenhum além daqui):');
    for (const f of failedPasswords) console.log(`  - ${f.name} <${f.email}>: ${f.tempPassword}`);
  }

  await prismaAdmin.auditLog.create({
    data: {
      lodgeId,
      action: 'UPDATE',
      entity: 'user',
      entityId: 'fix-bulk-grant-access-emails',
      after: JSON.stringify({ ...stats, total: targets.length, script: 'fix-bulk-grant-access-emails.ts' }),
    },
  });

  console.log('\nConcluído:', stats);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
