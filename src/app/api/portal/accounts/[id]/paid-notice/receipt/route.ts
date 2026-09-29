import { auth } from '@/lib/auth';
import { canSeePaymentHistory } from '@/lib/payment-history';
import { PAYMENT_NOTICE_ENTITY, PAYMENT_NOTICE_REJECT_ENTITY, withoutRejected } from '@/lib/portal-dues';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getPresignedDownloadUrl } from '@/lib/storage';
import { NextResponse } from 'next/server';

// Abre o comprovante anexado ao último "Já paguei" da conta (link temporário do storage
// privado). Vê: Tesoureiro/Administrador/Venerável (quem dá a baixa) e o próprio irmão.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;

  const staff = canSeePaymentHistory(session?.user?.role) && (await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'read')).ok;

  const found = await withTenant(lodgeId, async (db) => {
    const account = await db.account.findFirst({ where: { id, lodgeId }, select: { memberId: true } });
    if (!account) return null;
    if (!staff && (!memberId || account.memberId !== memberId)) return 'forbidden' as const;
    // Comprovante de aviso recusado (arquivo errado) não é mais "o comprovante da conta".
    const notices = withoutRejected(
      await db.auditLog.findMany({
        where: { lodgeId, entity: PAYMENT_NOTICE_ENTITY, entityId: id },
        select: { entityId: true, createdAt: true, after: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      await db.auditLog.findMany({ where: { lodgeId, entity: PAYMENT_NOTICE_REJECT_ENTITY, entityId: id }, select: { entityId: true, createdAt: true } }),
    );
    for (const n of notices) {
      try {
        const meta = JSON.parse(n.after ?? '{}') as { receiptKey?: string };
        if (meta.receiptKey) return meta.receiptKey;
      } catch { /* aviso sem metadados legíveis */ }
    }
    return null;
  });

  if (found === 'forbidden') return NextResponse.json({ error: 'Sem acesso a este comprovante.' }, { status: 403 });
  // A chave tem de ser desta loja (defesa extra: o prefixo carrega o lodgeId).
  if (!found || !found.startsWith(`payment-receipts/${lodgeId}/`)) {
    return NextResponse.json({ error: 'Nenhum comprovante anexado a esta conta.' }, { status: 404 });
  }
  const url = await getPresignedDownloadUrl(found, 300).catch(() => null);
  if (!url) return NextResponse.json({ error: 'Storage indisponível no momento.' }, { status: 503 });
  return NextResponse.redirect(url);
}
