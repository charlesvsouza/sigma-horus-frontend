import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { brl } from '@/lib/currency';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { PAYMENT_NOTICE_ENTITY, PAYMENT_NOTICE_REJECT_ENTITY, withoutRejected } from '@/lib/portal-dues';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Recusa um aviso "Já paguei" (comprovante errado, de outra conta, ilegível…): a conta volta
// à etapa anterior — em aberto, sem aviso — e o irmão pode avisar de novo com o comprovante
// certo (sem a carência de 24h). O aviso e o arquivo NÃO são apagados: a recusa é um registro
// próprio na auditoria, com o motivo. No Pix agrupado, recusa o grupo inteiro (é um só
// comprovante). Só quem dá baixa (escrita em Contas).
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const accountId = String(body?.accountId ?? '');
  const reason = String(body?.reason ?? '').trim().slice(0, 300);
  const notifyMember = body?.notifyMember !== false;
  if (!accountId) return NextResponse.json({ error: 'Conta não informada.' }, { status: 400 });
  if (reason.length < 3) return NextResponse.json({ error: 'Informe o motivo da recusa — ele vai para o irmão.' }, { status: 400 });

  const ctx = await withTenant(lodgeId, async (db) => {
    const [notices, rejections] = await Promise.all([
      db.auditLog.findMany({ where: { lodgeId, entity: PAYMENT_NOTICE_ENTITY, entityId: accountId }, select: { entityId: true, createdAt: true, after: true }, orderBy: { createdAt: 'desc' } }),
      db.auditLog.findMany({ where: { lodgeId, entity: PAYMENT_NOTICE_REJECT_ENTITY, entityId: accountId }, select: { entityId: true, createdAt: true } }),
    ]);
    return { notice: withoutRejected(notices, rejections)[0] ?? null };
  });
  if (!ctx.notice) return NextResponse.json({ error: 'Não há aviso de pagamento pendente nesta conta (já recusado ou já baixado). Recarregue a página.' }, { status: 409 });

  let meta: { memberId?: string; groupAccountIds?: string[]; groupTotal?: number; receiptKey?: string; amount?: number } = {};
  try { meta = JSON.parse(ctx.notice.after ?? '{}'); } catch { meta = {}; }
  const accountIds = meta.groupAccountIds?.length ? [...new Set(meta.groupAccountIds)] : [accountId];

  const data = await withTenant(lodgeId, async (db) => {
    const [accounts, lodge] = await Promise.all([
      db.account.findMany({ where: { lodgeId, id: { in: accountIds } }, select: { id: true, title: true, memberId: true, member: { select: { name: true, email: true } } } }),
      db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true } }),
    ]);
    for (const id of accountIds) {
      await logAudit(db, {
        lodgeId,
        userId: session.user.id,
        action: 'CREATE',
        entity: PAYMENT_NOTICE_REJECT_ENTITY,
        entityId: id,
        metadata: {
          reason,
          noticeAt: ctx.notice!.createdAt.toISOString(),
          memberId: meta.memberId ?? null,
          receiptKey: meta.receiptKey ?? null,
          ...(accountIds.length > 1 ? { groupAccountIds: accountIds } : {}),
          rejectedBy: { userId: session.user.id, name: session.user.name ?? 'Tesouraria' },
          notifyMember,
        },
      });
    }
    return { accounts, lodge };
  });

  // O irmão fica sabendo por quê e o que fazer (no portal a conta já voltou a "em aberto").
  let notified = false;
  const member = data.accounts.find((a) => a.member?.email)?.member ?? null;
  if (notifyMember && member?.email) {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br').replace(/\/+$/, '');
    const titles = data.accounts.map((a) => `- ${a.title}`).join('\n');
    const noticeAt = ctx.notice.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
    const total = meta.groupTotal ?? meta.amount;
    const text = `Prezado irmão ${member.name},

A Tesouraria conferiu o aviso de pagamento que você enviou em ${noticeAt}${typeof total === 'number' ? ` (${brl(total)})` : ''} e não pôde confirmá-lo:
${titles}

Motivo: ${reason}

A cobrança voltou a constar em aberto. Se você já pagou, basta enviar o comprovante correto pelo portal (botão "Já paguei"): ${appUrl}/dashboard/portal
Se ainda não pagou, o Pix continua disponível no mesmo lugar.

Fraternalmente,
Tesouraria — ${data.lodge?.name ?? ''}`;
    notified = await dispatch('email', member.email, 'Aviso de pagamento não confirmado — envie o comprovante correto', text, EMPTY_CHANNELS)
      .then((r) => r.status === 'sent')
      .catch(() => false);
  }

  return NextResponse.json({ success: true, accountIds, notified });
}
