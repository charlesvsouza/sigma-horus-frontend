/**
 * amm139: desfaz os 3 acordos de quitação iniciados em 04/10/2026 (Alexandre, Marcelo Gomes, Rafael):
 * apaga o acordo (itens e assinaturas saem junto), apaga a conta de multa/juros criada por ele e devolve o
 * irmão à situação "Ativo". As dívidas originais NÃO são tocadas.
 * Trava: só desfaz acordo aberto, sem assinatura e sem nenhum pagamento nos itens.
 * Simulação por padrão; gravar: --yes --i-know-this-is-a-real-lodge
 */
import { prismaAdmin } from '../src/lib/prisma';
import { refuseIfProtected } from './protected-lodges';

const BLOCK_IDS = ['cmuudztqv000204l4fab3nbxx', 'cmuue24f4000e04l4j2y8mz30', 'cmuue48a7000v04l4ghimth1e'];

async function main() {
  const yes = process.argv.includes('--yes');
  const blocks = await prismaAdmin.memberBlock.findMany({ where: { id: { in: BLOCK_IDS } }, include: { items: true, signatures: true, member: { select: { name: true, status: true } } } });
  if (blocks.length !== BLOCK_IDS.length) throw new Error(`Esperava ${BLOCK_IDS.length} acordos, achei ${blocks.length}.`);
  const plans: { b: (typeof blocks)[number]; extraIds: string[] }[] = [];
  for (const b of blocks) {
    if (b.status !== 'open' || b.signatures.length > 0) throw new Error(`${b.member.name}: acordo não está aberto/sem assinatura.`);
    const accs = await prismaAdmin.account.findMany({ where: { id: { in: b.items.map((i) => i.accountId) } }, include: { payments: { select: { id: true } } } });
    if (accs.some((a) => a.payments.length > 0)) throw new Error(`${b.member.name}: há pagamento em itens do acordo.`);
    const extraIds = b.items.filter((i) => i.kind !== 'debt').map((i) => i.accountId);
    plans.push({ b, extraIds });
    console.log(`${b.member.name} (${b.member.status}): apagar acordo ${b.id}, ${extraIds.length} conta(s) de multa/juros, e voltar a "active"`);
  }
  if (!yes) { console.log('[SIMULAÇÃO] nada gravado.'); return; }
  const refuse = refuseIfProtected('amm139', process.argv);
  if (refuse) { console.error(refuse); process.exitCode = 1; return; }
  await prismaAdmin.$transaction(async (tx) => {
    for (const { b, extraIds } of plans) {
      await tx.memberBlock.delete({ where: { id: b.id } });
      if (extraIds.length) await tx.account.deleteMany({ where: { id: { in: extraIds } } });
      await tx.member.update({ where: { id: b.memberId }, data: { status: 'active' } });
      await tx.auditLog.create({ data: { lodgeId: b.lodgeId, userId: null, action: 'DELETE', entity: 'member-block', entityId: b.id, after: JSON.stringify({ action: 'undo-agreement', memberId: b.memberId, kind: b.kind, total: b.total, extraAccounts: extraIds }) } });
    }
  });
  const left = await prismaAdmin.memberBlock.count({ where: { id: { in: BLOCK_IDS } } });
  const st = await prismaAdmin.member.findMany({ where: { id: { in: plans.map((p) => p.b.memberId) } }, select: { name: true, status: true } });
  console.log('Acordos restantes:', left, JSON.stringify(st));
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prismaAdmin.$disconnect());
