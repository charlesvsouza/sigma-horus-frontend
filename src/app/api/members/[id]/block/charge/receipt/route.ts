import { auth } from '@/lib/auth';
import { canHandleAgreementCharge } from '@/lib/agreement-charge';
import { agreementNoticeReceiptKey } from '@/lib/agreement-charge-server';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getPresignedDownloadUrl } from '@/lib/storage';
import { NextResponse } from 'next/server';

// Abre o comprovante que o irmão anexou ao "Já paguei" de uma parcela do acordo (link temporário do storage
// privado). Vê quem trata a cobrança do acordo: Tesoureiro, Venerável e Administrador.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'read');
  if (!access.ok || !canHandleAgreementCharge(session?.user?.role)) return NextResponse.json({ error: 'Sem acesso a este comprovante.' }, { status: 403 });

  const { id } = await params;
  const target = new URL(request.url).searchParams.get('target') ?? '';
  const key = await withTenant(lodgeId, (db) => agreementNoticeReceiptKey(db, lodgeId, id, target));
  if (!key) return NextResponse.json({ error: 'Nenhum comprovante anexado a esta parcela.' }, { status: 404 });
  const url = await getPresignedDownloadUrl(key, 300).catch(() => null);
  if (!url) return NextResponse.json({ error: 'Storage indisponível no momento.' }, { status: 503 });
  return NextResponse.redirect(url);
}
