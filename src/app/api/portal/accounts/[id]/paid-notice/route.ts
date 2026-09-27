import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { isAsaasMode } from '@/lib/collection';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { canPay, openBalance, PAYMENT_NOTICE_COOLDOWN_MS, PAYMENT_NOTICE_ENTITY } from '@/lib/portal-dues';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// "Já paguei" (Modo Loja): o Pix caiu direto na conta da loja e o sistema não fica
// sabendo. O irmão avisa; a Tesouraria confere no extrato e dá a baixa. O aviso NÃO
// baixa nada — só registra (auditoria) e manda e-mail para Tesoureiro e Administrador.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  if (!lodgeId || !memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'portal', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const note = String(body?.note ?? '').trim().slice(0, 300);

  const ctx = await withTenant(lodgeId, async (db) => {
    const account = await db.account.findFirst({
      where: { id, lodgeId, memberId },
      select: {
        id: true, title: true, type: true, amount: true, dueDate: true, status: true, memberId: true, approvalStatus: true,
        payments: { select: { amount: true } },
      },
    });
    const [lodge, member, last, staff] = await Promise.all([
      db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true, collectionMode: true } }),
      db.member.findUnique({ where: { id: memberId }, select: { name: true } }),
      db.auditLog.findFirst({
        where: { lodgeId, entity: PAYMENT_NOTICE_ENTITY, entityId: id },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.user.findMany({ where: { lodgeId, role: { in: ['treasurer', 'admin'] }, status: 'active' }, select: { email: true } }),
    ]);
    return { account, lodge, member, last, staff };
  });

  const { account, lodge, member, last, staff } = ctx;
  if (!account || !lodge || !member) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
  if (isAsaasMode(lodge)) {
    return NextResponse.json({ error: 'Nesta loja o pagamento pelo portal é confirmado automaticamente — não é preciso avisar.' }, { status: 409 });
  }
  const balance = openBalance(account, account.payments);
  if (!canPay(account, memberId, balance)) {
    return NextResponse.json({ error: 'Esta conta não está em aberto.' }, { status: 409 });
  }
  if (last && Date.now() - last.createdAt.getTime() < PAYMENT_NOTICE_COOLDOWN_MS) {
    return NextResponse.json({ error: 'Você já avisou a Tesouraria sobre esta conta nas últimas 24 horas.', paidNoticeAt: last.createdAt }, { status: 429 });
  }

  const createdAt = new Date();
  await withTenant(lodgeId, (db) =>
    logAudit(db, {
      lodgeId,
      userId: session!.user.id,
      action: 'CREATE',
      entity: PAYMENT_NOTICE_ENTITY,
      entityId: account.id,
      metadata: { memberId, amount: balance, title: account.title, note: note || null },
    }),
  );

  const subject = `Aviso de pagamento — ${member.name}`;
  const text = `O irmão ${member.name} informou pelo portal que pagou via Pix a conta "${account.title}" (vencimento ${formatDateOnly(account.dueDate)}), no valor de ${brl(balance)}.${note ? `\n\nObservação do irmão: ${note}` : ''}

Confira o crédito no extrato da conta da loja e registre o recebimento em Financeiro → Contas. Este aviso não dá baixa automática.

${lodge.name}`;
  const recipients = [...new Set(staff.map((u) => u.email).filter(Boolean))];
  await Promise.all(recipients.map((to) => dispatch('email', to, subject, text, EMPTY_CHANNELS).catch(() => null)));

  return NextResponse.json({ success: true, paidNoticeAt: createdAt, notified: recipients.length });
}
