import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { currentExpenseReceipt, EXPENSE_RECEIPT_ENTITY, EXPENSE_RECEIPT_REMOVED_ENTITY } from '@/lib/expense-receipt';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { buildObjectKey, deleteObject, getPresignedDownloadUrl, putObject } from '@/lib/storage';
import { receiptUploadError } from '@/lib/upload-guards';
import type { Prisma } from '@/generated/prisma/client';
import { NextResponse } from 'next/server';

// Comprovante de pagamento de uma despesa (conta a pagar). Mesmo storage privado e mesma
// referência em auditoria do comprovante de mensalidade.
//  GET    → abre o comprovante (link temporário). Leitura em Contas.
//  POST   → multipart `file` (PDF ou foto até 4 MB): anexa ou substitui. Escrita em Contas.
//  DELETE → remove o comprovante. Escrita em Contas.

type Ctx = { params: Promise<{ id: string }> };

async function latest(db: Prisma.TransactionClient, lodgeId: string, id: string) {
  const [attached, removed] = await Promise.all([
    db.auditLog.findMany({ where: { lodgeId, entity: EXPENSE_RECEIPT_ENTITY, entityId: id }, select: { createdAt: true, after: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.auditLog.findMany({ where: { lodgeId, entity: EXPENSE_RECEIPT_REMOVED_ENTITY, entityId: id }, select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  return currentExpenseReceipt(attached, removed);
}

export async function GET(_request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;

  const found = await withTenant(lodgeId, async (db) => {
    const account = await db.account.findFirst({ where: { id, lodgeId, type: 'PAYABLE' }, select: { id: true } });
    return account ? latest(db, lodgeId, id) : null;
  });
  // A chave tem de ser desta loja (defesa extra: o prefixo carrega o lodgeId).
  if (!found || !found.receiptKey.startsWith(`payment-receipts/${lodgeId}/`)) {
    return NextResponse.json({ error: 'Nenhum comprovante anexado a esta despesa.' }, { status: 404 });
  }
  const url = await getPresignedDownloadUrl(found.receiptKey, 300).catch(() => null);
  if (!url) return NextResponse.json({ error: 'Storage indisponível no momento.' }, { status: 503 });
  return NextResponse.redirect(url);
}

export async function POST(request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Anexe o comprovante (PDF ou foto).' }, { status: 400 });
  const invalid = receiptUploadError(file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const prev = await withTenant(lodgeId, async (db) => {
    const account = await db.account.findFirst({ where: { id, lodgeId }, select: { type: true } });
    if (!account) return 'notfound' as const;
    if (account.type !== 'PAYABLE') return 'not-payable' as const;
    return latest(db, lodgeId, id);
  });
  if (prev === 'notfound') return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
  if (prev === 'not-payable') return NextResponse.json({ error: 'O comprovante é das despesas (contas a pagar).' }, { status: 400 });

  const key = buildObjectKey(file.name, `payment-receipts/${lodgeId}`);
  const ok = await putObject(key, Buffer.from(await file.arrayBuffer()), file.type).catch(() => false);
  if (!ok) return NextResponse.json({ error: 'Não foi possível enviar o comprovante. Tente de novo.' }, { status: 502 });

  try {
    await withTenant(lodgeId, async (db) => {
      await logAudit(db, {
        lodgeId, userId: session.user.id, action: 'CREATE', entity: EXPENSE_RECEIPT_ENTITY, entityId: id,
        metadata: { receiptKey: key, receiptName: file.name.slice(0, 120), receiptType: file.type, replaced: Boolean(prev) },
      });
    });
  } catch (err) {
    await deleteObject(key).catch(() => {});
    throw err;
  }
  // Substituição: o arquivo anterior sai do storage (a referência fica na auditoria).
  if (prev && prev.receiptKey.startsWith(`payment-receipts/${lodgeId}/`)) await deleteObject(prev.receiptKey).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;

  const prev = await withTenant(lodgeId, async (db) => {
    const found = await latest(db, lodgeId, id);
    if (!found) return null;
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'DELETE', entity: EXPENSE_RECEIPT_REMOVED_ENTITY, entityId: id, metadata: { receiptName: found.receiptName } });
    return found;
  });
  if (!prev) return NextResponse.json({ error: 'Nenhum comprovante anexado a esta despesa.' }, { status: 404 });
  if (prev.receiptKey.startsWith(`payment-receipts/${lodgeId}/`)) await deleteObject(prev.receiptKey).catch(() => {});
  return NextResponse.json({ success: true });
}
