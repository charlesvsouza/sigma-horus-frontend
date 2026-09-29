import { auth } from '@/lib/auth';
import { invoiceOpenBalance } from '@/lib/charge-notice';
import { isAsaasMode } from '@/lib/collection';
import { submitPaymentNotice } from '@/lib/payment-notice-server';
import { PAYMENT_NOTICE_ENTITY, PAYMENT_NOTICE_REJECT_ENTITY, withoutRejected } from '@/lib/portal-dues';
import { CLOSED_INVOICE_STATUSES } from '@/lib/portal-invoice';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Comprovante recebido FORA do portal (ex.: o irmão respondeu no WhatsApp): quem dá baixa
// (escrita em Contas — Tesoureiro e Administrador, ou quem a matriz liberar) registra em nome
// do irmão. Mesma conferência e mesmo quadro de avisos de Pagamentos do "Já paguei"; a data do
// aviso é a da inclusão. Só Modo Loja (no Asaas a baixa é automática).
//  GET  → resumo da cobrança + aviso já existente (para oferecer "Substituir comprovante").
//  POST → multipart: file (PDF ou foto), note, paidAt (AAAA-MM-DD), notifyMember, replace.

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'accounts', 'write');
  if (!access.ok) return { ok: false as const, res: NextResponse.json({ error: access.error }, { status: access.status }) };

  const data = await withTenant(lodgeId, async (db) => {
    const invoice = await db.invoice.findFirst({
      where: { id, lodgeId },
      select: {
        id: true, number: true, amount: true, dueDate: true, status: true, accountId: true,
        member: { select: { id: true, name: true, email: true } },
        account: { select: { memberId: true, title: true, amount: true, status: true, payments: { select: { amount: true } } } },
      },
    });
    const lodge = await db.lodge.findUnique({ where: { id: lodgeId }, select: { collectionMode: true } });
    // Aviso recusado (comprovante errado) não conta como existente: registrar de novo não é "substituir".
    const last = invoice
      ? withoutRejected(
          await db.auditLog.findMany({
            where: { lodgeId, entity: PAYMENT_NOTICE_ENTITY, entityId: invoice.accountId },
            select: { entityId: true, createdAt: true, after: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
          await db.auditLog.findMany({
            where: { lodgeId, entity: PAYMENT_NOTICE_REJECT_ENTITY, entityId: invoice.accountId },
            select: { entityId: true, createdAt: true },
          }),
        )[0] ?? null
      : null;
    return { invoice, lodge, last };
  });

  const { invoice, lodge, last } = data;
  if (!invoice) return { ok: false as const, res: NextResponse.json({ error: 'Cobrança não encontrada.' }, { status: 404 }) };
  if (isAsaasMode(lodge)) return { ok: false as const, res: NextResponse.json({ error: 'No Modo Asaas a baixa é automática — não é preciso registrar comprovante.' }, { status: 409 }) };
  if (CLOSED_INVOICE_STATUSES.includes(invoice.status)) return { ok: false as const, res: NextResponse.json({ error: 'Esta cobrança já está paga ou cancelada.' }, { status: 409 }) };
  if (!invoice.member) return { ok: false as const, res: NextResponse.json({ error: 'Vincule a cobrança a um irmão para registrar o comprovante.' }, { status: 400 }) };
  // Cobrança em massa antiga (conta compartilhada, sem irmão): o aviso é por conta — não dá para atribuir.
  if (invoice.account?.memberId !== invoice.member.id) {
    return { ok: false as const, res: NextResponse.json({ error: 'Cobrança antiga compartilhada entre irmãos: registre a baixa direto em Pagamentos.' }, { status: 409 }) };
  }
  const balance = invoiceOpenBalance(invoice.amount, invoice.account);
  if (balance <= 0) return { ok: false as const, res: NextResponse.json({ error: 'Esta cobrança não tem saldo em aberto.' }, { status: 409 }) };

  let existing: { at: string; byStaff: string | null; hasReceipt: boolean } | null = null;
  if (last) {
    let meta: { receiptKey?: string; registeredBy?: { name?: string } } = {};
    try { meta = JSON.parse(last.after ?? '{}'); } catch { meta = {}; }
    existing = { at: last.createdAt.toISOString(), byStaff: meta.registeredBy?.name ?? null, hasReceipt: Boolean(meta.receiptKey) };
  }

  return { ok: true as const, session, lodgeId, invoice, member: invoice.member, balance, existing };
}

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await load(id);
  if (!c.ok) return c.res;
  return NextResponse.json({
    invoiceId: c.invoice.id,
    number: c.invoice.number,
    title: c.invoice.account?.title ?? '',
    memberName: c.member.name,
    memberHasEmail: Boolean(c.member.email),
    balance: c.balance,
    dueDate: c.invoice.dueDate.toISOString(),
    existing: c.existing,
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await load(id);
  if (!c.ok) return c.res;

  const form = await request.formData().catch(() => null);
  const f = form?.get('file');
  const file = f instanceof File && f.size > 0 ? f : null;
  if (!file) return NextResponse.json({ error: 'Anexe o comprovante (PDF ou foto).' }, { status: 400 });

  const role = String(c.session.user.role ?? '');
  const r = await submitPaymentNotice({
    lodgeId: c.lodgeId,
    memberId: c.member.id,
    userId: c.session.user.id,
    accountIds: [c.invoice.accountId],
    note: String(form?.get('note') ?? ''),
    file,
    registeredBy: { userId: c.session.user.id, name: c.session.user.name || c.session.user.email || 'Tesouraria', role },
    paidAtInformed: String(form?.get('paidAt') ?? '') || null,
    notifyMember: form?.get('notifyMember') === 'true',
    replace: form?.get('replace') === 'true',
  });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code ?? null, ...(r.paidNoticeAt ? { paidNoticeAt: r.paidNoticeAt } : {}) }, { status: r.status });
  return NextResponse.json({ success: true, paidNoticeAt: r.paidNoticeAt, receiptCheck: r.receiptCheck, receiptType: file.type });
}
