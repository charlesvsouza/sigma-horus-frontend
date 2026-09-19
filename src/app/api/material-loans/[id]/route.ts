import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

const STATUSES = ['returned', 'lost'];

async function getSessionAndCheck(lodgeId: string | undefined, role: string | undefined) {
  if (!lodgeId) return { error: 'Unauthorized', status: 401 } as const;
  const access = await requireLodgeAccess(String(lodgeId), role, 'materials', 'write');
  if (!access.ok) return { error: access.error, status: access.status } as const;
  return { ok: true as const };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const check = await getSessionAndCheck(lodgeId, role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const body = await request.json();
  const status = String(body?.status ?? '').trim();
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Status deve ser returned ou lost.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const loan = await db.materialLoan.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!loan) return { notFound: true as const };
    if (loan.status !== 'issued') return { notIssued: true as const };

    const updated = await db.materialLoan.update({
      where: { id },
      data: { status, returnedAt: new Date(), notes: body?.notes !== undefined ? (String(body.notes).trim() || null) : undefined },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'materialLoan', entityId: id, metadata: { status } });
    return { updated };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Fornecimento não encontrado.' }, { status: 404 });
  if ('notIssued' in result) return NextResponse.json({ error: 'Este fornecimento já foi encerrado.' }, { status: 409 });
  return NextResponse.json({ item: result.updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const check = await getSessionAndCheck(lodgeId, role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;

  const result = await withTenant(String(lodgeId), async (db) => {
    const loan = await db.materialLoan.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!loan) return { notFound: true as const };
    await db.materialLoan.delete({ where: { id } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'DELETE', entity: 'materialLoan', entityId: id, metadata: {} });
    return { ok: true as const };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Empréstimo não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
