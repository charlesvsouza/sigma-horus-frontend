/**
 * amm139: desfaz a renegociação em 16 parcelas do Jayme (feita pelo Administrador em 04/10/2026 22:27). Devolve as
 * 16 mensalidades ao estado de antes: R$ 110 (parte da Potência), vencimento dia 5 de 06/2025 a 09/2026, título
 * "Mensalidades", sem o sufixo "(renegociado — parcela n/16)". As cobranças (Invoice) abertas voltam junto.
 * O que a renegociação mudou nas contas foi só valor, vencimento e título — nada foi apagado nem pago.
 * Trava: exatamente 16 contas "renegociado", todas pendentes, sem pagamento e sem cobrança paga/emitida no Asaas.
 * Simulação por padrão; gravar: --yes --i-know-this-is-a-real-lodge
 */
import { prismaAdmin } from '../src/lib/prisma';
import { refuseIfProtected } from './protected-lodges';

const LODGE = 'cmte81osx000104l1d7cfhg5y';
const MEMBER = 'cmtod957c000204jmvj7irdtg';
const VALUE = 110;
const SUFFIX = /\s*\(renegociado — parcela (\d+)\/(\d+)\)\s*$/;

const dueFor = (i: number) => { const m = 5 + i; return new Date(`${2025 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-05T00:00:00.000Z`); };

async function main() {
  const yes = process.argv.includes('--yes');
  const accs = await prismaAdmin.account.findMany({
    where: { lodgeId: LODGE, memberId: MEMBER, title: { contains: 'renegociado' } },
    include: { payments: { select: { id: true } }, invoices: { select: { id: true, status: true, asaasPaymentId: true } } },
    orderBy: { dueDate: 'asc' },
  });
  if (accs.length !== 16) throw new Error(`Esperava 16 contas renegociadas, achei ${accs.length}.`);
  const plan = accs.map((a, i) => {
    const m = SUFFIX.exec(a.title);
    if (!m || Number(m[1]) !== i + 1 || Number(m[2]) !== 16) throw new Error(`Conta ${a.id}: título fora da ordem esperada (${a.title}).`);
    if (a.status !== 'pending' || a.payments.length > 0) throw new Error(`Conta ${a.id}: não está pendente/sem pagamento.`);
    if (a.invoices.some((v) => v.status === 'paid' || v.asaasPaymentId)) throw new Error(`Conta ${a.id}: cobrança paga ou emitida no Asaas.`);
    return { id: a.id, title: a.title.replace(SUFFIX, ''), dueDate: dueFor(i), from: `${a.dueDate.toISOString().slice(0, 10)} ${a.amount}`, invoiceIds: a.invoices.map((v) => v.id) };
  });
  for (const p of plan) console.log(`${p.id}: ${p.from} → ${p.dueDate.toISOString().slice(0, 10)} ${VALUE} "${p.title}" (${p.invoiceIds.length} cobrança(s))`);
  console.log(`Total depois: ${VALUE * 16} (era ${accs.reduce((s, a) => s + a.amount, 0).toFixed(2)})`);
  if (!yes) { console.log('[SIMULAÇÃO] nada gravado.'); return; }
  const refuse = refuseIfProtected('amm139', process.argv);
  if (refuse) { console.error(refuse); process.exitCode = 1; return; }
  await prismaAdmin.$transaction(async (tx) => {
    for (const p of plan) {
      await tx.account.update({ where: { id: p.id }, data: { amount: VALUE, dueDate: p.dueDate, title: p.title, status: 'pending' } });
      if (p.invoiceIds.length) await tx.invoice.updateMany({ where: { id: { in: p.invoiceIds } }, data: { amount: VALUE, dueDate: p.dueDate, status: 'pending' } });
    }
    await tx.auditLog.create({ data: { lodgeId: LODGE, userId: null, action: 'UPDATE', entity: 'account', entityId: MEMBER, after: JSON.stringify({ action: 'undo-renegotiate', memberId: MEMBER, installments: 16, restoredAmount: VALUE }) } });
  });
  const check = await prismaAdmin.account.findMany({ where: { lodgeId: LODGE, memberId: MEMBER, isDues: true, status: { not: 'paid' } }, orderBy: { dueDate: 'asc' }, select: { dueDate: true, amount: true, title: true } });
  console.log(`Depois: ${check.length} mensalidades em aberto, soma ${check.reduce((s, a) => s + a.amount, 0)}`);
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prismaAdmin.$disconnect());
