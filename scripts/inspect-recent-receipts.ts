// Somente leitura: mostra os últimos avisos de pagamento com comprovante, o resultado da
// conferência gravado e o texto que o sistema extraiu do PDF — para investigar por que um
// ponto (identificador, valor, recebedor, nº de controle) não foi reconhecido.
//   node --env-file=.env --import ./test/setup.mjs scripts/inspect-recent-receipts.ts [quantos]
import { prismaAdmin } from '@/lib/prisma';
import { getObjectBuffer } from '@/lib/storage';
import { pdfText } from '@/lib/receipt-pdf';
import { checkReceipt, receiptTxids } from '@/lib/receipt-check';

const take = Number(process.argv[2] ?? 3);

const notices = await prismaAdmin.auditLog.findMany({
  where: { entity: 'member-payment-notice' },
  select: { createdAt: true, entityId: true, lodgeId: true, after: true },
  orderBy: { createdAt: 'desc' },
  take: 30,
});

let shown = 0;
for (const n of notices) {
  let meta: { receiptKey?: string; receiptType?: string; receiptName?: string; receiptCheck?: unknown; amount?: number; registeredBy?: { name?: string } } = {};
  try { meta = JSON.parse(n.after ?? '{}'); } catch { continue; }
  if (!meta.receiptKey) continue;
  const invoices = await prismaAdmin.invoice.findMany({ where: { accountId: n.entityId }, select: { number: true } });
  console.log('='.repeat(80));
  console.log(`${n.createdAt.toISOString()} conta ${n.entityId} cobranças ${invoices.map((i) => i.number).join(', ')} valor ${meta.amount}`);
  console.log(`arquivo ${meta.receiptName} (${meta.receiptType})${meta.registeredBy ? ` registrado por ${meta.registeredBy.name}` : ''}`);
  console.log('conferência gravada:', JSON.stringify(meta.receiptCheck ?? null));
  if (meta.receiptType === 'application/pdf') {
    const buf = await getObjectBuffer(meta.receiptKey).catch(() => null);
    const text = buf ? await pdfText(buf) : '';
    console.log('--- texto extraído ---');
    console.log(text || '(não foi possível baixar)');
    if (text) {
      const lodge = await prismaAdmin.lodge.findUnique({ where: { id: n.lodgeId }, select: { cnpj: true, pixKey: true } });
      const again = checkReceipt(text, { txids: receiptTxids([n.entityId], invoices.map((i) => i.number)), amount: Number(meta.amount ?? 0), lodgeCnpj: lodge?.cnpj, lodgePixKey: lodge?.pixKey });
      console.log('--- reconferência com o código atual ---');
      console.log(JSON.stringify(again));
    }
  }
  if (++shown >= take) break;
}
await prismaAdmin.$disconnect();
