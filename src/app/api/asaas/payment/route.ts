import { auth } from '@/lib/auth';
import { createPayment } from '@/lib/asaas';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const customer = String(body?.customer ?? '').trim();
  const billingType = String(body?.billingType ?? 'BOLETO').trim() as 'BOLETO' | 'PIX' | 'CREDIT_CARD';
  const value = Number(body?.value ?? 0);
  const dueDate = String(body?.dueDate ?? '').trim();

  if (!customer || !['BOLETO', 'PIX', 'CREDIT_CARD'].includes(billingType) || !value || !dueDate) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  try {
    const result = await createPayment({ customer, billingType, value, dueDate, description: body?.description ? String(body.description) : undefined });
    if (!result) return NextResponse.json({ error: 'Asaas não configurado (ASAAS_API_KEY ausente).' }, { status: 503 });
    return NextResponse.json({ item: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erro Asaas.' }, { status: 502 });
  }
}
