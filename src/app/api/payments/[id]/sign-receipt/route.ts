import { auth } from '@/lib/auth';
import { signPaymentReceipt } from '@/lib/receipt-signature-server';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// "Assinar recibo": o Tesoureiro (ou o Venerável) assina digitalmente o recibo de um pagamento que ainda não tem
// assinatura — por exemplo, baixa automática do Asaas ou registrada por outro cargo. Idempotente: se já está assinado,
// devolve a assinatura existente.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Quem pode LER Contas e é Tesoureiro ou Venerável assina (o Venerável não tem escrita em Contas, mas assina o recibo);
  // a regra do cargo fica em signPaymentReceipt. Como é escrita, exige assinatura vigente.
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const sub = await requireActiveSubscription(String(lodgeId));
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: sub.status });

  const { id } = await params;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const result = await withTenant(String(lodgeId), (db) => signPaymentReceipt(db, String(lodgeId), id, String(session.user.id), ip));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, code: result.code, created: result.created });
}
