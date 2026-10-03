import { auth } from '@/lib/auth';
import { emitInvoiceCharge } from '@/lib/asaas-charge';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });
  const invoiceId = String(body?.invoiceId ?? '').trim();

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId é obrigatório.' }, { status: 400 });
  }

  const result = await emitInvoiceCharge({ lodgeId: String(lodgeId), invoiceId, actorId: session.user.id, billingType: body?.billingType });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    item: result.raw,
    bankSlipUrl: result.bankSlipUrl,
    invoiceUrl: result.invoiceUrl,
    pixCopyPaste: result.pix?.payload ?? null,
  });
}
