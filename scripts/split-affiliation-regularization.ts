/**
 * Separa, em TODAS as lojas, a categoria "1.1.03 Taxa de Filiação / Regularização" em duas:
 *   1.1.03 Taxa de Filiação      (candidato de filiação)
 *   1.1.10 Taxa de Regularização (obreiro que se regulariza: acordo do Art. 002, afastado, placet)
 * e move para a 1.1.10 os lançamentos que já existem e são de regularização:
 *   a) a taxa do acordo de regularização (MemberBlockItem kind='fee');
 *   b) planos de taxa de grau 'affiliation' cujo irmão NÃO é/foi candidato de filiação — viram kind
 *      'regularization' (e as cotas trocam o título);
 *   c) lançamentos da 1.1.03 cujo título cita "regulariz" (lançados à mão).
 * Os demais lançamentos da 1.1.03 (filiação de verdade, importados do Cenize como "Filiação") ficam onde estão
 * — não há como saber com segurança se eram regularização; o relatório final lista quantos sobraram.
 * Planos de filiação de verdade só trocam o título das cotas ("Taxa de Filiação / Regularização" → "Taxa de Filiação").
 * Idempotente: rodar de novo não muda nada. Cada loja é gravada numa transação (tudo ou nada).
 *
 * Uso (sempre simule primeiro, sem --yes; aceita um slug opcional para limitar a uma loja):
 *   node --env-file=.env --import ./test/setup.mjs scripts/split-affiliation-regularization.ts [slug]
 *
 * Gravar de verdade (loja real, como a amm139, exige a flag de proteção):
 *   node --env-file=.env --import ./test/setup.mjs scripts/split-affiliation-regularization.ts [slug] \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes [--i-know-this-is-a-real-lodge]
 */
import { prismaAdmin } from '../src/lib/prisma';
import { refuseIfProtected } from './protected-lodges';

const OLD_CHART_NAME = 'Taxa de Filiação / Regularização';
const AFFILIATION = { code: '1.1.03', name: 'Taxa de Filiação' };
const REGULARIZATION = { code: '1.1.10', name: 'Taxa de Regularização', type: 'REVENUE', category: 'Receitas Próprias' };

interface LodgeReport {
  slug: string;
  renamedChart: boolean;
  createdChart: boolean;
  moved: { fee: number; plans: number; manual: number };
  plansToRegularization: number;
  plansKeptAsAffiliation: number;
  retitled: number;
  leftInAffiliation: number;
  skipped?: string;
}

async function processLodge(lodge: { id: string; slug: string }, apply: boolean): Promise<LodgeReport> {
  const report: LodgeReport = {
    slug: lodge.slug, renamedChart: false, createdChart: false, moved: { fee: 0, plans: 0, manual: 0 },
    plansToRegularization: 0, plansKeptAsAffiliation: 0, retitled: 0, leftInAffiliation: 0,
  };
  const L = lodge.id;
  const affiliation = await prismaAdmin.chartAccount.findFirst({ where: { lodgeId: L, code: AFFILIATION.code } });
  let regularization = await prismaAdmin.chartAccount.findFirst({ where: { lodgeId: L, code: REGULARIZATION.code } });
  if (regularization && regularization.type !== REGULARIZATION.type) {
    report.skipped = `o código ${REGULARIZATION.code} está em uso por uma categoria de outro tipo (${regularization.name})`;
    return report;
  }
  if (!affiliation && !regularization) { report.skipped = 'a loja não tem a categoria 1.1.03 (nada a separar)'; return report; }

  // Quem é filiação de verdade: tem (ou teve) processo de candidato do tipo Filiação.
  const affiliatingMembers = new Set(
    (await prismaAdmin.candidateProcess.findMany({ where: { lodgeId: L, admissionKind: 'affiliation' }, select: { memberId: true } })).map((c) => c.memberId),
  );
  const plans = await prismaAdmin.degreeFeePlan.findMany({ where: { lodgeId: L, kind: 'affiliation' }, select: { id: true, memberId: true } });
  const regPlanIds = plans.filter((p) => !affiliatingMembers.has(p.memberId)).map((p) => p.id);
  const affPlanIds = plans.filter((p) => affiliatingMembers.has(p.memberId)).map((p) => p.id);
  report.plansToRegularization = regPlanIds.length;
  report.plansKeptAsAffiliation = affPlanIds.length;

  const feeItems = await prismaAdmin.memberBlockItem.findMany({ where: { lodgeId: L, kind: 'fee' }, select: { accountId: true } });
  const feeAccountIds = feeItems.map((i) => i.accountId);
  const inAff = affiliation
    ? await prismaAdmin.account.findMany({ where: { lodgeId: L, chartAccountId: affiliation.id }, select: { id: true, title: true, degreeFeePlanId: true } })
    : [];
  const toMove = new Set<string>();
  for (const a of inAff) {
    if (feeAccountIds.includes(a.id)) { report.moved.fee++; toMove.add(a.id); }
    else if (a.degreeFeePlanId && regPlanIds.includes(a.degreeFeePlanId)) { report.moved.plans++; toMove.add(a.id); }
    else if (!a.degreeFeePlanId && /regulariz/i.test(a.title)) { report.moved.manual++; toMove.add(a.id); }
  }
  report.leftInAffiliation = inAff.length - toMove.size;
  report.renamedChart = Boolean(affiliation && affiliation.name === OLD_CHART_NAME);
  report.createdChart = !regularization;

  if (!apply) return report;
  await prismaAdmin.$transaction(async (tx) => {
    if (!regularization) regularization = await tx.chartAccount.create({ data: { lodgeId: L, ...REGULARIZATION } });
    if (affiliation && affiliation.name === OLD_CHART_NAME) await tx.chartAccount.update({ where: { id: affiliation.id }, data: { name: AFFILIATION.name } });
    if (toMove.size > 0) await tx.account.updateMany({ where: { id: { in: [...toMove] } }, data: { chartAccountId: regularization.id } });
    if (regPlanIds.length > 0) await tx.degreeFeePlan.updateMany({ where: { id: { in: regPlanIds } }, data: { kind: 'regularization' } });
    // Títulos das cotas: "Taxa de Filiação / Regularização — cota 1/3" → o nome certo de cada tipo.
    for (const [ids, newLabel] of [[regPlanIds, 'Taxa de Regularização'], [affPlanIds, 'Taxa de Filiação']] as const) {
      if (ids.length === 0) continue;
      const cotas = await tx.account.findMany({ where: { degreeFeePlanId: { in: [...ids] }, title: { contains: OLD_CHART_NAME } }, select: { id: true, title: true } });
      for (const c of cotas) {
        await tx.account.update({ where: { id: c.id }, data: { title: c.title.replace(OLD_CHART_NAME, newLabel) } });
        report.retitled++;
      }
    }
    await tx.auditLog.create({
      data: { lodgeId: L, userId: null, action: 'UPDATE', entity: 'chart-split', entityId: regularization.id, after: JSON.stringify({ script: 'split-affiliation-regularization', moved: report.moved, plansToRegularization: report.plansToRegularization, retitled: report.retitled }) },
    });
  });
  return report;
}

async function main() {
  const argv = process.argv;
  const yes = argv.includes('--yes');
  const slug = argv.slice(2).find((a) => !a.startsWith('--') && a !== argv[argv.indexOf('--confirm-host') + 1]);
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;

  if (yes) {
    const dbUrl = process.env.DATABASE_URL ?? '';
    if (!confirmHost || !dbUrl.includes(confirmHost)) {
      console.error('[RECUSADO] --confirm-host não bate com o DATABASE_URL atual.');
      process.exitCode = 1;
      return;
    }
  }

  const lodges = await prismaAdmin.lodge.findMany({ where: slug ? { slug } : {}, select: { id: true, slug: true }, orderBy: { slug: 'asc' } });
  if (lodges.length === 0) { console.error('Nenhuma loja encontrada.'); process.exitCode = 1; return; }

  const rows: Record<string, unknown>[] = [];
  for (const lodge of lodges) {
    const refusal = yes ? refuseIfProtected(lodge.slug, argv) : null;
    if (refusal) { console.error(refusal); rows.push({ loja: lodge.slug, situação: 'RECUSADA (loja real sem a flag)' }); continue; }
    const r = await processLodge(lodge, yes);
    rows.push({
      loja: r.slug,
      situação: r.skipped ? `pulada: ${r.skipped}` : yes ? 'gravada' : 'simulação',
      'renomeia 1.1.03': r.renamedChart ? 'sim' : 'não',
      'cria 1.1.10': r.createdChart ? 'sim' : 'já existe',
      'taxa do acordo': r.moved.fee,
      'cotas de planos': r.moved.plans,
      'lançados à mão': r.moved.manual,
      'planos → regularização': r.plansToRegularization,
      'planos ficam filiação': r.plansKeptAsAffiliation,
      'títulos trocados': yes ? r.retitled : '—',
      'ficam na 1.1.03': r.leftInAffiliation,
    });
  }
  console.table(rows);
  if (!yes) console.log('[SIMULAÇÃO] Nada foi gravado. Rode de novo com --confirm-host <trecho> --yes para gravar.');
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
