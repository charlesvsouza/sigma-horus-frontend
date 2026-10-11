import { auth } from '@/lib/auth';
import { proofPrefix } from '@/lib/payment-proof';
import { proofsByPayment } from '@/lib/payment-proof-server';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getPresignedDownloadUrl } from '@/lib/storage';
import { NextResponse } from 'next/server';

// Abre o comprovante de pagamento de UMA baixa de despesa (link temporário). Leitura em Contas.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'read', session?.user?.memberId ? String(session.user.memberId) : null);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;

  const proof = await withTenant(lodgeId, async (db) => {
    const payment = await db.payment.findFirst({ where: { id, lodgeId }, select: { id: true } });
    return payment ? (await proofsByPayment(db, lodgeId, [id])).get(id) ?? null : null;
  });
  // A chave tem de ser desta loja (defesa extra: o prefixo carrega o lodgeId).
  if (!proof || !proof.receiptKey.startsWith(proofPrefix(lodgeId))) return NextResponse.json({ error: 'Nenhum comprovante anexado a este pagamento.' }, { status: 404 });
  const url = await getPresignedDownloadUrl(proof.receiptKey, 300).catch(() => null);
  if (!url) return NextResponse.json({ error: 'Storage indisponível no momento.' }, { status: 503 });
  return NextResponse.redirect(url);
}
