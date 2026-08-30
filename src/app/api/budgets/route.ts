import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getBudgetComparison } from '@/lib/budget';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const year = Number(new URL(request.url).searchParams.get('year')) || new Date().getFullYear();
  const items = await withTenant(String(lodgeId), (db) => getBudgetComparison(db, String(lodgeId), year));
  return NextResponse.json({ year, items });
}

// Upsert de UMA linha (ano + categoria) — o form da UI salva célula por célula.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const year = Number(body?.year);
  const chartAccountId = String(body?.chartAccountId ?? '');
  const plannedAmount = Number(body?.plannedAmount ?? 0);

  if (!year || !chartAccountId || Number.isNaN(plannedAmount) || plannedAmount < 0) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    const chart = await db.chartAccount.findFirst({ where: { id: chartAccountId, lodgeId: String(lodgeId) }, select: { id: true } });
    if (!chart) return null;

    const upserted = await db.budget.upsert({
      where: { lodgeId_year_chartAccountId: { lodgeId: String(lodgeId), year, chartAccountId } },
      create: { lodgeId: String(lodgeId), year, chartAccountId, plannedAmount },
      update: { plannedAmount },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'budget', entityId: upserted.id, metadata: { year, chartAccountId, plannedAmount } });
    return upserted;
  });

  if (!item) return NextResponse.json({ error: 'Categoria do plano de contas não encontrada.' }, { status: 404 });
  return NextResponse.json({ item });
}
