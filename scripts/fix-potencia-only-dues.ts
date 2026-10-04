/**
 * amm139: Jayme e Geraldo pagam só a parte da Potência (R$ 110). Cria as mensalidades de 110 de
 * 06/2025 a 09/2026 (dia 5), no lugar da conta única do Jayme, e acerta outubro/2026 para 110.
 * Também marca o benefício "só a Potência" nos dois e grava a parte da Potência (R$ 110) na loja
 * (exige a migration 20261010120000 aplicada antes).
 * Simulação por padrão; gravar: --yes --i-know-this-is-a-real-lodge
 */
import { prismaAdmin } from '../src/lib/prisma';
import { refuseIfProtected } from './protected-lodges';

const LODGE = 'cmte81osx000104l1d7cfhg5y';
const CHART = 'cmte81qfh001d04l1f1iofyiz';
const BANK = 'cmu4bwa4j000304jn49po62xz';
const DESC = 'Lançamento de mensalidades em aberto ano/gestões anteriores — parte da Potência';
const VALUE = 110;
const NAMES = ['JAYME BARBOSA DE FREITAS FILHO', 'GERALDO ROBERTO PEIXOTO'];

const wanted: Date[] = [];
for (let i = 0; i < 16; i++) { const m = 5 + i; wanted.push(new Date(`${2025 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-05`)); }
type Plan = { mem: { id: string }; lump: { id: string }[]; toCreate: Date[]; toFix: { id: string }[] };
const key = (d: Date) => d.toISOString().slice(0, 7);

async function main() {
  const yes = process.argv.includes('--yes');
  const plans: Plan[] = [];
  for (const name of NAMES) {
    const mem = await prismaAdmin.member.findFirstOrThrow({ where: { lodgeId: LODGE, name } });
    const accs = await prismaAdmin.account.findMany({ where: { lodgeId: LODGE, memberId: mem.id, isDues: true }, include: { payments: true, invoices: true } });
    const lump = accs.filter((a) => a.amount === 1760 && a.description?.includes('até'));
    const oct = accs.filter((a) => key(a.dueDate) === '2026-10');
    for (const a of [...lump, ...oct]) if (a.payments.length || a.invoices.some((i) => i.asaasPaymentId || i.status !== 'pending')) throw new Error(`${name}: ${a.id} tem pagamento/cobrança`);
    const keep = new Set(accs.filter((a) => !lump.includes(a)).map((a) => key(a.dueDate)));
    const toCreate = wanted.filter((d) => !keep.has(key(d)));
    const toFix = accs.filter((a) => key(a.dueDate) === '2026-09' || key(a.dueDate) === '2026-10');
    plans.push({ mem, lump, toCreate, toFix });
    console.log(`${name}: apagar ${lump.length} conta(s) única(s); criar ${toCreate.length} (${toCreate.map((d) => key(d)).join(' ')}); ajustar p/ ${VALUE}: ${toFix.map((a) => `${key(a.dueDate)}(${a.amount})`).join(' ')}`);
  }
  if (!yes) { console.log('[SIMULAÇÃO] nada gravado.'); return; }
  const refuse = refuseIfProtected('amm139', process.argv);
  if (refuse) { console.error(refuse); process.exitCode = 1; return; }
  await prismaAdmin.$transaction(async (tx) => {
    await tx.lodge.update({ where: { id: LODGE }, data: { powerDuesAmount: VALUE } });
    for (const p of plans) {
      await tx.member.update({ where: { id: p.mem.id }, data: { duesPotencyOnly: true, duesPotencyReason: 'lodge' } });
      if (p.lump.length) await tx.account.deleteMany({ where: { id: { in: p.lump.map((a) => a.id) } } });
      await tx.account.createMany({ data: p.toCreate.map((d) => ({ lodgeId: LODGE, memberId: p.mem.id, chartAccountId: CHART, bankAccountId: BANK, type: 'RECEIVABLE', title: 'Mensalidades', amount: VALUE, dueDate: d, status: 'pending', isDues: true, approvalStatus: 'approved', description: DESC })) });
      await tx.account.updateMany({ where: { id: { in: p.toFix.map((a) => a.id) } }, data: { amount: VALUE, chartAccountId: CHART, bankAccountId: BANK } });
      await tx.invoice.updateMany({ where: { accountId: { in: p.toFix.map((a) => a.id) }, status: 'pending', asaasPaymentId: null }, data: { amount: VALUE } });
    }
  });
  const chk = await prismaAdmin.account.groupBy({ by: ['memberId'], where: { lodgeId: LODGE, memberId: { in: plans.map((p) => p.mem.id) }, isDues: true }, _count: true, _sum: { amount: true } });
  console.table(chk);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prismaAdmin.$disconnect());
