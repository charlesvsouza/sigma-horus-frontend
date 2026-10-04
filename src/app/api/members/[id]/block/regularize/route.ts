import { auth } from '@/lib/auth';
import { regularizeSettledBlock } from '@/lib/member-block-server';
import { canBlockMembers, parseBlockInput } from '@/lib/member-block';
import { todayBR } from '@/lib/date-only';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Acordo de quitação já pago e o irmão decidiu regularizar: abre o acordo de REGULARIZAÇÃO só com a taxa
// (e multa/juros, se houver). O irmão segue bloqueado até pagar. Só Venerável e Administrador.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!canBlockMembers(session.user.role)) {
    return NextResponse.json({ error: 'Só o Venerável Mestre ou o Administrador podem abrir o acordo de regularização.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = parseBlockInput({ ...body, kind: 'regularization' }, todayBR());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await regularizeSettledBlock(String(lodgeId), id, String(session.user.id), parsed.value);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, blockId: result.blockId });
}
