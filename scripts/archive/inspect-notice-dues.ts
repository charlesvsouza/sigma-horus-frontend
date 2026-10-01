// Somente leitura: para cada aviso "Já paguei" recente, mostra a origem (portal x Tesouraria),
// a flag isDues da conta, a categoria (e se ela é mensalidade), e as baixas geradas.
//   node --env-file=.env --import ./test/setup.mjs scripts/archive/inspect-notice-dues.ts
import { prismaAdmin } from '@/lib/prisma';

const notices = await prismaAdmin.auditLog.findMany({
  where: { entity: 'member-payment-notice' },
  select: { createdAt: true, entityId: true, lodgeId: true, after: true },
  orderBy: { createdAt: 'desc' },
  take: 40,
});
for (const n of notices) {
  let meta: { registeredBy?: { name?: string } } = {};
  try { meta = JSON.parse(n.after ?? '{}'); } catch { /* */ }
  const a = await prismaAdmin.account.findUnique({
    where: { id: n.entityId },
    select: { title: true, isDues: true, status: true, createdAt: true, lodge: { select: { name: true, art002Enabled: true } }, chartAccount: { select: { code: true, name: true, isDues: true } }, member: { select: { name: true } }, payments: { select: { paidAt: true, method: true, note: true } } },
  });
  if (!a) { console.log(n.createdAt.toISOString(), 'conta sumiu', n.entityId); continue; }
  console.log([
    n.createdAt.toISOString().slice(0, 16),
    a.lodge.name.slice(0, 18), `art002=${a.lodge.art002Enabled}`,
    meta.registeredBy ? `TESOURARIA(${meta.registeredBy.name})` : 'PORTAL',
    a.member?.name?.slice(0, 22), `"${a.title.slice(0, 30)}"`,
    `isDues=${a.isDues}`, `cat=${a.chartAccount ? `${a.chartAccount.code} dues=${a.chartAccount.isDues}` : 'nenhuma'}`,
    `status=${a.status}`, `pagos=${a.payments.length}`, a.payments.map((p) => (p.note ?? "").slice(0, 50)).join(" ; "),
  ].join(' | '));
}
await prismaAdmin.$disconnect();
