import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { NextResponse } from 'next/server';

const FIELDS = [
  'name', 'legalName', 'tradeName', 'cnpj', 'email', 'phone',
  'addressLine', 'addressNumber', 'neighborhood', 'city', 'state', 'zipCode',
  'bankName', 'bankAgency', 'bankAccount', 'pixKey',
  'riteName', 'powerName', 'sessionWeekdays', 'sessionFrequency',
] as const;

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lodge = await withTenant(String(lodgeId), (db) =>
    db.lodge.findUnique({
      where: { id: String(lodgeId) },
      select: {
        name: true, legalName: true, tradeName: true, cnpj: true, email: true, phone: true,
        addressLine: true, addressNumber: true, neighborhood: true, city: true, state: true, zipCode: true,
        bankName: true, bankAgency: true, bankAccount: true, pixKey: true,
        riteName: true, powerName: true, sessionWeekdays: true, sessionFrequency: true,
      },
    }),
  );

  return NextResponse.json({ lodge });
}

export async function PUT(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (normalizeRole(role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem editar os dados da loja.' }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, string | null> = {};
  for (const field of FIELDS) {
    if (field in body) {
      const value = String(body[field] ?? '').trim();
      data[field] = value || null;
    }
  }
  if (!data.name) {
    return NextResponse.json({ error: 'O nome da loja é obrigatório.' }, { status: 400 });
  }

  const lodge = await withTenant(String(lodgeId), async (db) => {
    const updated = await db.lodge.update({ where: { id: String(lodgeId) }, data });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'lodge', entityId: String(lodgeId), metadata: { fields: Object.keys(data) } });
    return updated;
  });

  return NextResponse.json({ ok: true, lodge: { name: lodge.name } });
}
