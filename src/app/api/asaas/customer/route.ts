import { auth } from '@/lib/auth';
import { createCustomer } from '@/lib/asaas';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const name = String(body?.name ?? '').trim();
  const email = String(body?.email ?? '').trim();
  const cpfCnpj = String(body?.cpfCnpj ?? '').trim();

  if (!name || !email || !cpfCnpj) {
    return NextResponse.json({ error: 'name, email e cpfCnpj são obrigatórios.' }, { status: 400 });
  }

  try {
    const result = await createCustomer({ name, email, cpfCnpj, phone: body?.phone ? String(body.phone) : undefined });
    if (!result) return NextResponse.json({ error: 'Asaas não configurado (ASAAS_API_KEY ausente).' }, { status: 503 });
    return NextResponse.json({ item: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erro Asaas.' }, { status: 502 });
  }
}
