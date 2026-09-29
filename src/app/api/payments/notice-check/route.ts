import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PAYMENT_NOTICE_CHECK_ENTITY, PAYMENT_NOTICE_ENTITY } from '@/lib/portal-dues';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { checkReceipt, receiptTxids } from '@/lib/receipt-check';
import { pdfText } from '@/lib/receipt-pdf';
import { getObjectBuffer } from '@/lib/storage';
import { NextResponse } from 'next/server';

// Confere o comprovante em PDF de um aviso "Já paguei" já enviado (avisos de antes da conferência
// automática, ou para conferir de novo). Não altera o aviso: grava a conferência num registro
// próprio da auditoria, que o painel de Pagamentos lê. Só quem dá baixa (escrita em Contas).
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const accountId = String(body?.accountId ?? '');

  const ctx = await withTenant(lodgeId, async (db) => ({
    notice: await db.auditLog.findFirst({
      where: { lodgeId, entity: PAYMENT_NOTICE_ENTITY, entityId: accountId },
      select: { after: true },
      orderBy: { createdAt: 'desc' },
    }),
    lodge: await db.lodge.findUnique({ where: { id: lodgeId }, select: { cnpj: true, pixKey: true } }),
  }));
  let meta: { receiptKey?: string; receiptType?: string; amount?: number; groupAccountIds?: string[]; groupTotal?: number } = {};
  try { meta = JSON.parse(ctx.notice?.after ?? '{}'); } catch { meta = {}; }
  if (!meta.receiptKey || !meta.receiptKey.startsWith(`payment-receipts/${lodgeId}/`)) {
    return NextResponse.json({ error: 'Este aviso não tem comprovante anexado.' }, { status: 404 });
  }
  if (meta.receiptType !== 'application/pdf') {
    return NextResponse.json({ error: 'Só comprovantes em PDF são conferidos automaticamente. Confira a imagem pelo "Ver comprovante".' }, { status: 409 });
  }
  const accountIds = meta.groupAccountIds?.length ? meta.groupAccountIds : [accountId];
  // Pix do WhatsApp leva o nº da cobrança como identificador; o do portal, o id da conta.
  const invoices = await withTenant(lodgeId, (db) => db.invoice.findMany({ where: { lodgeId, accountId: { in: accountIds } }, select: { number: true } }));
  const buffer = await getObjectBuffer(meta.receiptKey).catch(() => null);
  if (!buffer) return NextResponse.json({ error: 'Não foi possível abrir o comprovante no armazenamento.' }, { status: 503 });

  const receiptCheck = checkReceipt(await pdfText(buffer), {
    txids: receiptTxids(accountIds, invoices.map((i) => i.number)),
    amount: Number(meta.groupTotal ?? meta.amount ?? 0),
    lodgeCnpj: ctx.lodge?.cnpj,
    lodgePixKey: ctx.lodge?.pixKey,
  });
  await withTenant(lodgeId, (db) =>
    logAudit(db, { lodgeId, userId: session!.user.id, action: 'CREATE', entity: PAYMENT_NOTICE_CHECK_ENTITY, entityId: accountId, metadata: { receiptCheck } }),
  );
  return NextResponse.json({ receiptCheck });
}
