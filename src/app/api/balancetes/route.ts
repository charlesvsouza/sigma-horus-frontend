import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { generateBalancete } from '@/lib/balancete';
import { NextResponse } from 'next/server';

// Balancete periódico (trimestral/semestral) apresentado em sessão — exigido
// pelo regulamento independentemente do encerramento do veneralato inteiro.
// Diferente do CashClose: não trava período, não depende de um Term, pode ser
// gerado quantas vezes for preciso para qualquer intervalo de datas.
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.balancete.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { periodTo: 'desc' } }),
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
  const from = body?.periodFrom ? new Date(body.periodFrom) : null;
  const to = body?.periodTo ? new Date(body.periodTo) : null;
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: 'Informe um período válido (de/até).' }, { status: 400 });
  }
  const periodTo = new Date(to);
  periodTo.setHours(23, 59, 59, 999);

  const item = await withTenant(String(lodgeId), (db) =>
    generateBalancete(db, { lodgeId: String(lodgeId), from, to: periodTo, notes, createdById: session.user.id }),
  );

  return NextResponse.json({ item });
}
