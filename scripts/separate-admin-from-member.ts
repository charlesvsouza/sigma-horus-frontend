/**
 * Separa os papéis numa loja em que o Administrador é também obreiro com um único login:
 *   1. cria um NOVO Administrador (e-mail próprio, sem vínculo com membro);
 *   2. devolve o login antigo à condição de OBREIRO (papel "member", continua ligado ao cadastro de
 *      membro, mesma senha e mesmo e-mail).
 * É a migração única para a regra "papéis não se confundem" — a rota normal de rebaixar Administrador
 * foi bloqueada de propósito, então isto só se faz por aqui, com o novo Administrador criado antes.
 *
 * A senha do novo Administrador NÃO vai na linha de comando nem em arquivo: vem da variável de
 * ambiente NEW_ADMIN_PASSWORD (nunca é impressa). Ele troca a senha no 1º acesso.
 *
 * Simulação por padrão. Para gravar: --yes --confirm-host <host> (e, em loja real protegida,
 * --i-know-this-is-a-real-lodge).
 *
 * Uso (PowerShell):
 *   $env:NEW_ADMIN_PASSWORD = '...'
 *   node --env-file=.env --import ./test/setup.mjs scripts/separate-admin-from-member.ts <slug> --old-email a@x.com --new-email b@x.com --new-name "Nome" [--yes --confirm-host <host>]
 */
import bcrypt from 'bcryptjs';
import { prismaAdmin } from '../src/lib/prisma';
import { MAX_ADMINS, memberUsesEmail, normalizeEmail } from '../src/lib/admin-policy';
import { refuseIfProtected } from './protected-lodges';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const slug = argv.find((a, i) => !a.startsWith('--') && !['--old-email', '--new-email', '--new-name', '--confirm-host'].includes(argv[i - 1] ?? ''));

async function main() {
  const yes = argv.includes('--yes');
  const refusal = yes ? refuseIfProtected(slug, argv) : null;
  if (refusal) { console.error(refusal); process.exitCode = 1; return; }

  const oldEmail = normalizeEmail(opt('--old-email'));
  const newEmail = normalizeEmail(opt('--new-email'));
  const newName = (opt('--new-name') ?? '').trim();
  if (!slug || !oldEmail || !newEmail || newName.length < 3) {
    console.error('Uso: separate-admin-from-member.ts <slug> --old-email <e-mail> --new-email <e-mail> --new-name "<nome>" [--yes --confirm-host <host>]');
    process.exitCode = 1;
    return;
  }
  const lodge = await prismaAdmin.lodge.findFirst({ where: { slug }, select: { id: true, name: true } });
  if (!lodge) { console.error(`Loja "${slug}" não encontrada.`); process.exitCode = 1; return; }
  console.log(`Loja: ${lodge.name}`);

  const old = await prismaAdmin.user.findFirst({
    where: { lodgeId: lodge.id, email: { equals: oldEmail, mode: 'insensitive' } },
    select: { id: true, name: true, email: true, role: true, status: true, memberId: true, member: { select: { name: true, email: true } } },
  });
  const problems: string[] = [];
  if (!old) problems.push(`Não há usuário com o e-mail ${oldEmail} nesta loja.`);
  else if (old.role !== 'admin') problems.push(`O usuário ${old.email} não é Administrador (papel atual: ${old.role}).`);
  if (await prismaAdmin.user.findUnique({ where: { email: newEmail }, select: { id: true } })) problems.push(`O e-mail ${newEmail} já está cadastrado como usuário.`);
  if (await memberUsesEmail(lodge.id, newEmail)) problems.push(`O e-mail ${newEmail} já é e-mail de um membro desta loja.`);
  const activeAdmins = await prismaAdmin.user.count({ where: { lodgeId: lodge.id, role: 'admin', status: 'active' } });
  if (activeAdmins + 1 > MAX_ADMINS) problems.push(`A loja já tem ${activeAdmins} Administrador(es) ativo(s); o teto é ${MAX_ADMINS}.`);

  console.log(`Administrador atual: ${old?.name ?? '?'} <${old?.email ?? oldEmail}> — ligado ao membro: ${old?.member ? `${old.member.name} <${old.member.email ?? 'sem e-mail'}>` : 'NÃO'}`);
  console.log(`Novo Administrador:  ${newName} <${newEmail}> (sem vínculo com membro, senha provisória → troca no 1º acesso)`);
  console.log(`Depois: ${old?.email ?? oldEmail} passa a OBREIRO (papel "member")${old?.member ? `, continua ligado ao cadastro de ${old.member.name}` : ''}.`);
  if (problems.length) { console.error('\n[NÃO PODE PROSSEGUIR]\n - ' + problems.join('\n - ')); process.exitCode = 1; return; }

  if (!yes) { console.log('\n[SIMULAÇÃO] Nada foi gravado. Para gravar: defina NEW_ADMIN_PASSWORD e use --yes --confirm-host <host>.'); return; }
  if (!(process.env.DATABASE_URL ?? '').includes(opt('--confirm-host') ?? '\0')) { console.error('\n[RECUSADO] --confirm-host não bate com o DATABASE_URL atual.'); process.exitCode = 1; return; }
  const password = process.env.NEW_ADMIN_PASSWORD ?? '';
  if (password.length < 8) { console.error('\n[RECUSADO] defina NEW_ADMIN_PASSWORD (mín. 8 caracteres) no ambiente.'); process.exitCode = 1; return; }
  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prismaAdmin.$transaction(async (tx) => {
    // Cria o novo ANTES de rebaixar o antigo: a loja nunca fica sem Administrador.
    const user = await tx.user.create({
      data: { name: newName, email: newEmail, passwordHash, role: 'admin', lodgeId: lodge.id, mustChangePassword: true },
      select: { id: true },
    });
    await tx.user.update({ where: { id: old!.id }, data: { role: 'member' } });
    await tx.auditLog.create({ data: { lodgeId: lodge.id, action: 'CREATE', entity: 'user', entityId: user.id, after: JSON.stringify({ role: 'admin', email: newEmail, via: 'separate-admin-from-member' }) } });
    await tx.auditLog.create({ data: { lodgeId: lodge.id, action: 'UPDATE', entity: 'user', entityId: old!.id, after: JSON.stringify({ role: 'member', previousRole: 'admin', via: 'separate-admin-from-member' }) } });
    return user;
  });
  console.log(`\nConcluído. Novo Administrador criado (${created.id}); ${oldEmail} agora é obreiro.`);
  console.log('As sessões abertas refletem a mudança de papel em até ~30 segundos.');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prismaAdmin.$disconnect());
