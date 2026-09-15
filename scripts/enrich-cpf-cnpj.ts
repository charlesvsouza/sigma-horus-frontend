/**
 * Enriquecimento de CPF/CNPJ a partir de CLIENTES.pdf/FORNECEDORES.pdf do
 * backup Cenize — preenche Member.cpf (membros sem CPF) e
 * Counterparty.document (contrapartes sem documento), e cria Counterparty
 * novo para quem não bateu com nada já cadastrado (ex.: ex-membro inadimplente
 * que não teve nenhum lançamento realizado no extrato, só título em aberto).
 *
 * Espera um plano pré-computado (ver conversa/scripts de análise) em JSON:
 *   { memberUpdates: [{id,document}], cpUpdates: [{id,document,isCompany}],
 *     newCounterparties: [{name,document,isCompany,kind}] }
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/enrich-cpf-cnpj.ts <lodgeId> <plano.json>
 *
 * Para gravar de verdade:
 *   node --env-file=.env --import ./test/setup.mjs scripts/enrich-cpf-cnpj.ts <lodgeId> <plano.json> \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 */
import { readFileSync } from 'node:fs';
import { prismaAdmin } from '../src/lib/prisma';

interface Plan {
  memberUpdates: { id: string; name: string; document: string }[];
  cpUpdates: { id: string; name: string; document: string; isCompany: boolean }[];
  newCounterparties: { name: string; document: string; isCompany: boolean; kind: string }[];
}

async function main() {
  const argv = process.argv;
  const lodgeId = argv[2];
  const planPath = argv[3];
  const yes = argv.includes('--yes');
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;

  if (!lodgeId || !planPath) {
    console.error('Uso: enrich-cpf-cnpj.ts <lodgeId> <plano.json> [--confirm-host <trecho>] [--yes]');
    process.exitCode = 1;
    return;
  }

  const plan: Plan = JSON.parse(readFileSync(planPath, 'utf8'));

  console.log(`Member.cpf a preencher: ${plan.memberUpdates.length}`);
  console.log(`Counterparty.document a preencher: ${plan.cpUpdates.length}`);
  console.log(`Counterparty novo a criar: ${plan.newCounterparties.length}`);

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

  for (const m of plan.memberUpdates) {
    await prismaAdmin.member.update({ where: { id: m.id }, data: { cpf: m.document } });
  }
  for (const c of plan.cpUpdates) {
    await prismaAdmin.counterparty.update({ where: { id: c.id }, data: { document: c.document, isCompany: c.isCompany } });
  }
  let created = 0;
  for (const n of plan.newCounterparties) {
    await prismaAdmin.counterparty.create({
      data: { lodgeId, name: n.name, document: n.document, isCompany: n.isCompany, kind: n.kind },
    });
    created++;
  }

  console.log(`\nConcluído: ${plan.memberUpdates.length} Member(s), ${plan.cpUpdates.length} Counterparty(ies) atualizada(s), ${created} Counterparty(ies) nova(s).`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
