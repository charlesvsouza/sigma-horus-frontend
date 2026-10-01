/**
 * Move o saldo remanescente do sistema anterior de volta de
 * FinancialAccount.openingBalance para um lançamento categorizado (1.5.04 —
 * Saldo para Abertura de Escrituração), para que ele apareça na Razão por
 * categoria. É o inverso pontual de fix-amm-opening-balance.ts (2026-09-18),
 * que tinha movido esses mesmos valores de "Account fantasma" para
 * openingBalance — aquele script resolveu a inflação indevida do card "A
 * receber" (Account paga sem Payment real); este cria a Account+Payment de
 * verdade (via settleAccountAsPaid, mesma função que a API usa), então não
 * reintroduz o bug original.
 *
 * Saldo de cada conta não muda: zera o Saldo inicial e cria um Payment do
 * mesmo valor na mesma conta, na data de abertura da escrituração digital
 * (decisão do tesoureiro: 2026-09-11).
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/archive/recategorize-amm-opening-balance.ts
 *
 * Para gravar de verdade:
 *   node --env-file=.env --import ./test/setup.mjs scripts/archive/recategorize-amm-opening-balance.ts \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 */
import { prismaAdmin } from '../../src/lib/prisma';
import { settleAccountAsPaid } from '../../src/lib/account-status';
import { findClosedTermForDate } from '../../src/lib/term-lock';
import { refuseIfProtected } from '../protected-lodges';

const LODGE_ID = 'cmte81osx000104l1d7cfhg5y'; // amm139
const LODGE_SLUG = 'amm139';
const OPEN_DATE = new Date('2026-09-11T12:00:00.000Z'); // meio-dia evita virar de fuso

const PLAN = [
  { financialAccountName: 'CONTA CORRENTE', amount: 9819.78 },
  { financialAccountName: 'CONTA INVESTIMENTO', amount: 124289.94 },
] as const;

async function main() {
  const argv = process.argv;
  const yes = argv.includes('--yes');
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;

  const refusal = refuseIfProtected(LODGE_SLUG, argv);
  if (refusal) { console.error(refusal); process.exitCode = 1; return; }

  const chart = await prismaAdmin.chartAccount.findFirst({ where: { lodgeId: LODGE_ID, code: '1.5.04' }, select: { id: true, code: true, name: true } });
  if (!chart) { console.error('[ABORTADO] ChartAccount 1.5.04 não encontrada nesta loja.'); process.exitCode = 1; return; }

  const locked = await findClosedTermForDate(prismaAdmin, LODGE_ID, OPEN_DATE);
  if (locked) { console.error(`[ABORTADO] ${OPEN_DATE.toISOString().slice(0, 10)} cai dentro do veneralato encerrado "${locked.title}".`); process.exitCode = 1; return; }

  const plan: { financialAccountId: string; financialAccountName: string; amount: number; currentOpening: number }[] = [];
  for (const item of PLAN) {
    const fa = await prismaAdmin.financialAccount.findFirst({ where: { lodgeId: LODGE_ID, name: item.financialAccountName }, select: { id: true, openingBalance: true, active: true } });
    if (!fa) { console.error(`[ABORTADO] FinancialAccount "${item.financialAccountName}" não encontrada.`); process.exitCode = 1; return; }
    if (!fa.active) { console.error(`[ABORTADO] "${item.financialAccountName}" está inativa.`); process.exitCode = 1; return; }
    if (Number(fa.openingBalance) !== item.amount) {
      console.error(`[ABORTADO] "${item.financialAccountName}" tem Saldo inicial ${fa.openingBalance}, esperado ${item.amount} — dado mudou desde a análise, revise antes de rodar de novo.`);
      process.exitCode = 1;
      return;
    }
    plan.push({ financialAccountId: fa.id, financialAccountName: item.financialAccountName, amount: item.amount, currentOpening: Number(fa.openingBalance) });
  }

  console.log(`Plano (categoria ${chart.code} — ${chart.name}, data de abertura ${OPEN_DATE.toISOString().slice(0, 10)}):`);
  for (const p of plan) {
    console.log(`- "${p.financialAccountName}": Saldo inicial ${p.currentOpening.toFixed(2)} → 0,00; cria lançamento Recebida de R$ ${p.amount.toFixed(2)} na categoria 1.5.04, mesma conta.`);
  }

  if (!yes) {
    console.log('\n[SIMULAÇÃO] Nada foi gravado. Rode de novo com --confirm-host <trecho> --yes para gravar.');
    return;
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!confirmHost || !dbUrl.includes(confirmHost)) {
    console.error('\n[RECUSADO] --confirm-host não bate com o DATABASE_URL atual.');
    process.exitCode = 1;
    return;
  }

  for (const p of plan) {
    await prismaAdmin.$transaction(async (tx) => {
      await tx.financialAccount.update({ where: { id: p.financialAccountId }, data: { openingBalance: 0 } });

      const account = await tx.account.create({
        data: {
          lodgeId: LODGE_ID,
          title: `${chart.name} — ${p.financialAccountName}`,
          type: 'RECEIVABLE',
          amount: p.amount,
          dueDate: OPEN_DATE,
          status: 'pending', // settleAccountAsPaid abaixo gera o Payment e o status real
          chartAccountId: chart.id,
          bankAccountId: p.financialAccountId,
          approvalStatus: 'approved',
          description: 'Saldo remanescente migrado do sistema anterior, recategorizado de FinancialAccount.openingBalance para aparecer na Razão por categoria (script recategorize-amm-opening-balance, 2026-09-22).',
        },
      });

      const settled = await settleAccountAsPaid(tx, {
        lodgeId: LODGE_ID,
        account: { id: account.id, amount: p.amount, memberId: null, type: 'RECEIVABLE', approvalStatus: 'approved' },
        bankAccountId: p.financialAccountId,
        paidAt: OPEN_DATE,
      });
      if (!settled.ok) throw new Error(`settleAccountAsPaid falhou para "${p.financialAccountName}": ${settled.error}`);

      await tx.account.update({ where: { id: account.id }, data: { status: 'paid' } });

      await tx.auditLog.create({
        data: {
          lodgeId: LODGE_ID,
          userId: null,
          action: 'UPDATE',
          entity: 'financialAccount',
          entityId: p.financialAccountId,
          before: JSON.stringify({ openingBalance: p.currentOpening }),
          after: JSON.stringify({ reason: 'recategorize-amm-opening-balance-2026-09-22', openingBalance: 0, createdAccountId: account.id, chartAccountCode: '1.5.04', paidAt: OPEN_DATE.toISOString() }),
        },
      });
    });
    console.log(`Concluído: "${p.financialAccountName}" — Saldo inicial zerado, lançamento de R$ ${p.amount.toFixed(2)} criado e recebido na categoria 1.5.04.`);
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
