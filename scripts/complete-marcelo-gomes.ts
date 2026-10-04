/**
 * amm139: completa a sequência de mensalidades de dívida passada do Marcelo Gomes Duarte
 * (03/2025 a 03/2026), criando só os meses que faltam. Simulação por padrão; gravar: --yes --i-know-this-is-a-real-lodge
 */
import { prismaAdmin } from '../src/lib/prisma';
import { refuseIfProtected } from './protected-lodges';

const LODGE = 'cmte81osx000104l1d7cfhg5y';
const CHART = 'cmte81qfh001d04l1f1iofyiz';
const BANK = 'cmu4bwa4j000304jn49po62xz';
const DESC = 'Lançamento de mensalidades em aberto ano/gestões anteriores';

async function main() {
  const yes = process.argv.includes('--yes');
  const mem = await prismaAdmin.member.findFirstOrThrow({ where: { lodgeId: LODGE, name: 'MARCELO GOMES DUARTE' } });
  const wanted: Date[] = [];
  for (let i = 0; i < 13; i++) { const m = 2 + i; wanted.push(new Date(`${2025 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-05`)); }
  const have = await prismaAdmin.account.findMany({ where: { lodgeId: LODGE, memberId: mem.id, isDues: true, dueDate: { gte: wanted[0], lte: wanted[12] } }, select: { dueDate: true, status: true } });
  const haveKeys = new Set(have.map((a) => a.dueDate.toISOString().slice(0, 7)));
  const missing = wanted.filter((d) => !haveKeys.has(d.toISOString().slice(0, 7)));
  console.log('já existem:', [...haveKeys].sort().join(', '), '| status:', [...new Set(have.map((a) => a.status))].join(','));
  console.log('a criar:', missing.map((d) => d.toISOString().slice(0, 10)).join(', '));
  if (!yes) { console.log('[SIMULAÇÃO] nada gravado.'); return; }
  const refuse = refuseIfProtected('amm139', process.argv);
  if (refuse) { console.error(refuse); process.exitCode = 1; return; }
  await prismaAdmin.account.createMany({ data: missing.map((d) => ({ lodgeId: LODGE, memberId: mem.id, chartAccountId: CHART, bankAccountId: BANK, type: 'RECEIVABLE', title: 'Mensalidades', amount: 220, dueDate: d, status: 'pending', isDues: true, approvalStatus: 'approved', description: DESC })) });
  console.log('Criadas:', missing.length);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prismaAdmin.$disconnect());
