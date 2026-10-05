/**
 * amm139: SOMENTE LEITURA. Mostra o que há de renegociação/acordo do Jayme: contas (valor, vencimento, status,
 * pagamentos), acordos, faturas e a trilha de auditoria (quem renegociou e quando).
 * Uso: npx tsx scripts/inspect-jayme-renegotiation.ts
 */
import { prismaAdmin } from '../src/lib/prisma';

async function main() {
  const lodge = await prismaAdmin.lodge.findFirst({ where: { slug: 'amm139' }, select: { id: true, name: true } })
    ?? await prismaAdmin.lodge.findFirst({ where: { name: { contains: 'amm', mode: 'insensitive' } }, select: { id: true, name: true } });
  if (!lodge) throw new Error('Loja amm139 não encontrada.');
  const members = await prismaAdmin.member.findMany({ where: { lodgeId: lodge.id, name: { contains: 'jayme', mode: 'insensitive' } }, select: { id: true, name: true, status: true, duesPotencyOnly: true, birthDate: true } });
  console.log('Loja:', lodge.name, '| irmãos:', JSON.stringify(members));
  for (const m of members) {
    const accounts = await prismaAdmin.account.findMany({
      where: { lodgeId: lodge.id, memberId: m.id },
      orderBy: { dueDate: 'asc' },
      select: { id: true, title: true, amount: true, dueDate: true, status: true, type: true, description: true, createdAt: true, updatedAt: true, payments: { select: { amount: true, paidAt: true } }, chartAccount: { select: { name: true } } },
    });
    console.log(`\n=== ${m.name}: ${accounts.length} conta(s)`);
    for (const a of accounts) {
      const paid = a.payments.reduce((s, p) => s + Number(p.amount), 0);
      console.log(`${a.dueDate.toISOString().slice(0, 10)} | ${String(a.amount).padStart(8)} | ${a.status.padEnd(8)} | pago ${paid} | ${a.type} | ${a.chartAccount?.name ?? '-'} | ${a.title} | criada ${a.createdAt.toISOString().slice(0, 10)} atualizada ${a.updatedAt.toISOString().slice(0, 16)} | ${a.description ?? ''}`);
    }
    const blocks = await prismaAdmin.memberBlock.findMany({ where: { memberId: m.id }, include: { items: true } });
    console.log('Acordos:', JSON.stringify(blocks.map((b) => ({ id: b.id, status: b.status, kind: b.kind, total: b.total, installments: b.installments, items: b.items.length, createdAt: b.createdAt }))));
    const audits = await prismaAdmin.auditLog.findMany({
      where: { lodgeId: lodge.id, OR: [{ entityId: m.id }, { after: { contains: m.id } }, { entity: { contains: 'renegotiat' } }] },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, action: true, entity: true, entityId: true, userId: true, after: true, user: { select: { name: true, email: true, role: true } } },
    });
    console.log(`Auditoria (${audits.length}):`);
    for (const a of audits) console.log(`${a.createdAt.toISOString().slice(0, 16)} | ${a.action} ${a.entity} ${a.entityId} | por ${a.user?.name ?? a.userId ?? 'sistema'} (${a.user?.role ?? '-'}) | ${(a.after ?? '').slice(0, 300)}`);
  }
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prismaAdmin.$disconnect());
