import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// PASSO 3 do encerramento: o Admin encerra o veneralato. Só é permitido após o
// fechamento de caixa (PASSO 1) E a aprovação da prestação de contas (PASSO 2).
// Ao encerrar, o período fica travado: nenhum lançamento pode cair em
// [startDate, endDate] (ver lib/term-lock). O saldo final será herdado pelo
// próximo veneralato criado (ver POST /api/terms).
export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const s = await auth();
  const lodgeId = s?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (normalizeRole(s?.user?.role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas o Administrador pode encerrar o veneralato.' }, { status: 403 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const term = await db.term.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!term) return { error: 'notfound' as const };
    if (term.status === 'closed') return { error: 'already' as const };

    const close = await db.cashClose.findUnique({ where: { lodgeId_termId: { lodgeId: String(lodgeId), termId: id } } });
    if (!close) return { error: 'no-close' as const };
    if (!close.approved) return { error: 'not-approved' as const };

    // Garante limites do período para a trava funcionar (precisa de endDate).
    const endDate = term.endDate ?? new Date();

    const updated = await db.term.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date(), closedById: s.user.id, endDate },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: s.user.id, action: 'UPDATE', entity: 'term', entityId: id, metadata: { closed: true, closingBalance: close.closingBalance } });
    return { updated, closingBalance: close.closingBalance };
  });

  if ('error' in result) {
    switch (result.error) {
      case 'notfound':
        return NextResponse.json({ error: 'Período não encontrado.' }, { status: 404 });
      case 'already':
        return NextResponse.json({ error: 'Este veneralato já está encerrado.' }, { status: 409 });
      case 'no-close':
        return NextResponse.json({ error: 'Feche o caixa do período antes de encerrar.' }, { status: 409 });
      case 'not-approved':
        return NextResponse.json({ error: 'A prestação de contas precisa ser aprovada pelo Venerável antes do encerramento.' }, { status: 409 });
      default:
        return NextResponse.json({ error: 'Não foi possível encerrar o veneralato.' }, { status: 409 });
    }
  }

  return NextResponse.json({ item: result.updated, closingBalance: result.closingBalance });
}
