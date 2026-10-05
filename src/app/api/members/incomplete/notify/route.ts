import { auth } from '@/lib/auth';
import { sendIncompleteRecordNotices } from '@/lib/incomplete-record-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Botão "Avisar por e-mail" da tela de cadastros incompletos: pede a cada irmão com e-mail que complete o
// próprio cadastro e manda o resumo ao Secretário. Não repete o pedido ao mesmo irmão em menos de 7 dias.
export async function POST() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const stats = await sendIncompleteRecordNotices(lodgeId, { members: true, secretary: true, throttleDays: 7 });
  return NextResponse.json({ success: true, ...stats });
}
