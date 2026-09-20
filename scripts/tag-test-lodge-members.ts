/**
 * Acrescenta um sufixo ao nome de todos os membros de uma loja de TESTE, para que
 * ela nunca coincida com nomes de membros de outras lojas.
 * Com --counterparties, marca também os clientes/fornecedores criados por importação (e o nome
 * copiado nas contas deles). Idempotente: quem já tem o sufixo não é tocado. Desfazer: --remove.
 *
 * Simulação por padrão; para gravar: --yes --confirm-host <trecho do host do DATABASE_URL>.
 *
 * Uso:
 *   node --env-file=.env --import ./test/setup.mjs scripts/tag-test-lodge-members.ts <slug> [--suffix " (TESTE)"] [--remove] [--counterparties] [--yes --confirm-host <host>]
 */
import { prismaAdmin } from '../src/lib/prisma';
import { refuseIfProtected } from './protected-lodges';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const slug = argv.find((a, i) => !a.startsWith('--') && !['--suffix', '--confirm-host'].includes(argv[i - 1] ?? ''));
const suffix = opt('--suffix') ?? ' (TESTE)';
const remove = argv.includes('--remove');
const withCounterparties = argv.includes('--counterparties');

async function main() {
  if (!slug) { console.error('Uso: tag-test-lodge-members.ts <slug> [--suffix " (TESTE)"] [--remove] [--counterparties] [--yes --confirm-host <host>]'); process.exitCode = 1; return; }
  const refusal = argv.includes('--yes') ? refuseIfProtected(slug, argv) : null;
  if (refusal) { console.error(refusal); process.exitCode = 1; return; }
  const lodge = await prismaAdmin.lodge.findFirst({ where: { slug }, select: { id: true, name: true } });
  if (!lodge) { console.error(`Loja "${slug}" não encontrada.`); process.exitCode = 1; return; }
  console.log(`Loja: ${lodge.name}`);

  const members = await prismaAdmin.member.findMany({ where: { lodgeId: lodge.id }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  const plan = members
    .map((m) => {
      const has = m.name.endsWith(suffix);
      if (remove) return has ? { id: m.id, from: m.name, to: m.name.slice(0, -suffix.length) } : null;
      return has ? null : { id: m.id, from: m.name, to: `${m.name}${suffix}` };
    })
    .filter((x): x is { id: string; from: string; to: string } => x !== null);

  const swap = (name: string) => (remove ? (name.endsWith(suffix) ? name.slice(0, -suffix.length) : null) : (name.endsWith(suffix) ? null : `${name}${suffix}`));
  const cps = withCounterparties
    ? (await prismaAdmin.counterparty.findMany({ where: { lodgeId: lodge.id, notes: { contains: '[import:legacy:' } }, select: { id: true, name: true } }))
        .flatMap((c) => { const to = swap(c.name); return to ? [{ id: c.id, from: c.name, to }] : []; })
    : [];
  if (withCounterparties) console.log(`${cps.length} cliente(s)/fornecedor(es) importado(s) serão ${remove ? 'restaurados' : 'renomeados'} (ex.: ${cps[0] ? `${cps[0].from} → ${cps[0].to}` : '—'}).`);

  console.log(`${plan.length} de ${members.length} membro(s) serão ${remove ? 'restaurados' : 'renomeados'}:`);
  for (const p of plan) console.log(`  ${p.from}  →  ${p.to}`);

  if (!argv.includes('--yes')) { console.log('\n[SIMULAÇÃO] Nada foi gravado. Para gravar: --yes --confirm-host <trecho do host>.'); return; }
  if (!(process.env.DATABASE_URL ?? '').includes(opt('--confirm-host') ?? '\0')) { console.error('\n[RECUSADO] --confirm-host não bate com o DATABASE_URL atual.'); process.exitCode = 1; return; }

  await prismaAdmin.$transaction(async (tx) => {
    for (const p of plan) await tx.member.update({ where: { id: p.id }, data: { name: p.to } });
    for (const c of cps) {
      await tx.counterparty.update({ where: { id: c.id }, data: { name: c.to } });
      // o nome também é copiado em cada conta (snapshot)
      await tx.account.updateMany({ where: { lodgeId: lodge.id, counterpartyId: c.id }, data: { counterpartyName: c.to } });
    }
  }, { timeout: 120_000, maxWait: 20_000 });
  console.log(`\nConcluído: ${plan.length} membro(s) e ${cps.length} cliente(s)/fornecedor(es) atualizado(s).`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prismaAdmin.$disconnect());
