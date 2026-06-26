import { auth } from '@/lib/auth';
import { createCustomer } from '@/lib/asaas';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const name = String(body?.name ?? '').trim();
  const email = body?.email ? String(body.email).trim() : undefined;
  const cpfCnpj = String(body?.cpfCnpj ?? '').trim();

  if (!name || !cpfCnpj) {
    return NextResponse.json({ error: 'name e cpfCnpj são obrigatórios.' }, { status: 400 });
  }

  const lodge = await withTenant(String(lodgeId), (db) =>
    db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { asaasApiKeyEnc: true, asaasEnv: true } }),
  );
  const config = buildLodgeAsaasConfig(lodge);
  if (!config) {
    return NextResponse.json({ error: 'Asaas não conectado para esta loja. Configure em Integrações.' }, { status: 409 });
  }

  try {
    const result = await createCustomer(config, { name, email, cpfCnpj, phone: body?.phone ? String(body.phone) : undefined });
    return NextResponse.json({ item: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro Asaas.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
