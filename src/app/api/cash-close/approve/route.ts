import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// PASSO 2 do encerramento: o Venerável aprova a prestação de contas do período.
// Sem esta aprovação o Admin não consegue encerrar o veneralato.
export async function POST(request: Request) {
  const s = await auth();
  const lodgeId = s?.user?.lodgeId;
  const role = normalizeRole(s?.user?.role);
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'venerable' && role !== 'admin') {
    return NextResponse.json({ error: 'Apenas o Venerável (ou Administrador) pode aprovar a prestação de contas.' }, { status: 403 });
  }

  const body = await request.json();
  const termId = String(body?.termId ?? '');
  if (!termId) return NextResponse.json({ error: 'termId é obrigatório.' }, { status: 400 });

  const result = await withTenant(String(lodgeId), async (db) => {
    const close = await db.cashClose.findUnique({ where: { lodgeId_termId: { lodgeId: String(lodgeId), termId } } });
    if (!close) return { error: 'no-close' as const };
    if (close.approved) return { error: 'already' as const };

    const updated = await db.cashClose.update({
      where: { id: close.id },
      data: { approved: true, approvedAt: new Date(), approvedById: s.user.id },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: s.user.id, action: 'UPDATE', entity: 'cashClose', entityId: close.id, metadata: { approved: true, termId } });
    return { updated };
  });

  if ('error' in result) {
    if (result.error === 'no-close') return NextResponse.json({ error: 'Feche o caixa do período antes de aprovar a prestação de contas.' }, { status: 409 });
    return NextResponse.json({ error: 'A prestação de contas já está aprovada.' }, { status: 409 });
  }

  return NextResponse.json({ item: result.updated });
}
