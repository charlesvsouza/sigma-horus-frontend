/**
 * amm139: divide contas únicas de mensalidade em parcelas mensais e padroniza
 * categoria (Mensalidades), banco (CONTA CORRENTE) e observação nas mensalidades de gestões anteriores.
 * Simulação por padrão; gravar: --yes --i-know-this-is-a-real-lodge
 */
import { prismaAdmin } from '../src/lib/prisma';
import { refuseIfProtected } from './protected-lodges';

const LODGE = 'cmte81osx000104l1d7cfhg5y';
const CHART = 'cmte81qfh001d04l1f1iofyiz';
const BANK = 'cmu4bwa4j000304jn49po62xz';
const DESC = 'Lançamento de mensalidades em aberto ano/gestões anteriores';
const MEMBERS: Record<string, string> = {};
// conta única -> mês inicial e final (AAAA-MM)
const SPLIT = [
  { name: 'LUCIANO REYNALDO DAS NEVES', from: '2026-06', to: '2026-09', total: 880 },
  { name: 'YURI BAKO RIBEIRO', from: '2026-06', to: '2026-09', total: 880 },
  { name: 'MARANYLZO DA SILVA MUNIZ  NETO', from: '2026-06', to: '2026-09', total: 880 },
  { name: 'LUÍZ CLÁUDIO DE ANDRADE', from: '2026-07', to: '2026-09', total: 660 },
];
// já lançados mês a mês: só padronizar categoria/banco/observação
const STANDARDIZE = ['RAFAEL WEHINGER', 'MARCUS PEREIRA RODRIGUES', 'ALEXANDRE PEIXOTO OSWALDINO', 'MARCELO GOMES DUARTE'];

function months(from: string, to: string) {
  const out: Date[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(new Date(`${y}-${String(m).padStart(2, '0')}-05`)); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

async function main() {
  const yes = process.argv.includes('--yes');
  const plan: { memberId: string; name: string; lumpId: string; dates: Date[] }[] = [];
  for (const s of SPLIT) {
    const mem = await prismaAdmin.member.findFirstOrThrow({ where: { lodgeId: LODGE, name: s.name } });
    const dates = months(s.from, s.to);
    const lumps = await prismaAdmin.account.findMany({ where: { lodgeId: LODGE, memberId: mem.id, isDues: true, status: 'pending', amount: s.total, description: { contains: 'até' } }, include: { payments: true, invoices: true } });
    if (lumps.length !== 1 || lumps[0].payments.length || lumps[0].invoices.length) throw new Error(`${s.name}: conta única não encontrada/limpa (${lumps.length})`);
    const clash = await prismaAdmin.account.count({ where: { lodgeId: LODGE, memberId: mem.id, isDues: true, dueDate: { in: dates }, id: { not: lumps[0].id } } });
    if (clash) throw new Error(`${s.name}: já existe mensalidade em ${clash} dessas datas`);
    if (dates.length * 220 !== s.total) throw new Error(`${s.name}: total não fecha`);
    plan.push({ memberId: mem.id, name: s.name, lumpId: lumps[0].id, dates });
    console.log(`${s.name}: apagar ${lumps[0].id} (${s.total}) e criar ${dates.length}x220 (${s.from} a ${s.to})`);
  }
  for (const name of STANDARDIZE) {
    const mem = await prismaAdmin.member.findFirstOrThrow({ where: { lodgeId: LODGE, name } });
    MEMBERS[name] = mem.id;
    const n = await prismaAdmin.account.count({ where: { lodgeId: LODGE, memberId: mem.id, isDues: true, status: 'pending', dueDate: { lt: new Date('2026-09-01') } } });
    console.log(`${name}: padronizar ${n} mensalidade(s) pendentes`);
  }
  if (!yes) { console.log('[SIMULAÇÃO] nada gravado.'); return; }
  const refuse = refuseIfProtected('amm139', process.argv);
  if (refuse) { console.error(refuse); process.exitCode = 1; return; }
  await prismaAdmin.$transaction(async (tx) => {
    for (const p of plan) {
      await tx.account.delete({ where: { id: p.lumpId } });
      await tx.account.createMany({ data: p.dates.map((d) => ({ lodgeId: LODGE, memberId: p.memberId, chartAccountId: CHART, bankAccountId: BANK, type: 'RECEIVABLE', title: 'Mensalidades', amount: 220, dueDate: d, status: 'pending', isDues: true, approvalStatus: 'approved', description: DESC })) });
    }
    for (const id of Object.values(MEMBERS)) {
      await tx.account.updateMany({ where: { lodgeId: LODGE, memberId: id, isDues: true, status: 'pending', dueDate: { lt: new Date('2026-09-01') } }, data: { chartAccountId: CHART, bankAccountId: BANK, description: DESC } });
    }
  });
  const ids = [...plan.map((p) => p.memberId), ...Object.values(MEMBERS)];
  const chk = await prismaAdmin.account.groupBy({ by: ['chartAccountId', 'bankAccountId', 'description'], where: { lodgeId: LODGE, memberId: { in: ids }, description: DESC }, _count: true, _sum: { amount: true } });
  console.table(chk);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prismaAdmin.$disconnect());
