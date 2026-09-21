import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';
import { hasAtMostCents } from '@/lib/money';

const KINDS = ['bank', 'cash'];

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.financialAccount.findMany({
      where: { lodgeId: String(lodgeId) },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const name = String(body?.name ?? '').trim();
  const kind = String(body?.kind ?? '').trim();

  if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'Tipo deve ser bank ou cash.' }, { status: 400 });
  const openingBalance = Number(body?.openingBalance) || 0;
  if (!hasAtMostCents(openingBalance)) return NextResponse.json({ error: 'Saldo inicial inválido: use no máximo 2 casas decimais.' }, { status: 400 });

  const created = await withTenant(String(lodgeId), async (db) => {
    const item = await db.financialAccount.create({
      data: {
        lodgeId: String(lodgeId),
        name,
        kind,
        bankName: kind === 'bank' && body?.bankName ? String(body.bankName).trim() : null,
        isInvestment: kind === 'bank' ? Boolean(body?.isInvestment) : false,
        agency: kind === 'bank' && body?.agency ? String(body.agency).trim() : null,
        accountNumber: kind === 'bank' && body?.accountNumber ? String(body.accountNumber).trim() : null,
        openingBalance,
        isDefault: Boolean(body?.isDefault),
      },
    });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session!.user.id,
      action: 'CREATE',
      entity: 'financialAccount',
      entityId: item.id,
      metadata: { name, kind },
    });
    return item;
  });

  return NextResponse.json({ item: created });
}
