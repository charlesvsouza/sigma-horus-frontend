import { auth } from '@/lib/auth';
import { liftBlock } from '@/lib/member-block-server';
import { canBlockMembers } from '@/lib/member-block';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// O irmão volta: só com o acordo totalmente pago, por decisão do Venerável Mestre ou do Administrador
// (é quem também comunica a Potência). A recorrência dele recomeça no próximo vencimento.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!canBlockMembers(session.user.role)) {
    return NextResponse.json({ error: 'Só o Venerável Mestre ou o Administrador podem liberar o irmão.' }, { status: 403 });
  }

  const { id } = await params;
  const result = await liftBlock(String(lodgeId), id, String(session.user.id));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
