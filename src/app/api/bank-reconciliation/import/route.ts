import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { importBankStatement } from '@/lib/bank-reconciliation';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const content = String(body?.content ?? '');
  if (!content.trim()) {
    return NextResponse.json({ error: 'Arquivo vazio ou inválido.' }, { status: 400 });
  }

  const summary = await withTenant(String(lodgeId), (db) => importBankStatement(db, String(lodgeId), content));

  if (summary.parsed === 0) {
    return NextResponse.json({ error: 'Não foi possível reconhecer nenhuma transação neste arquivo. Confira se é um OFX ou CSV válido.' }, { status: 400 });
  }

  return NextResponse.json(summary);
}
