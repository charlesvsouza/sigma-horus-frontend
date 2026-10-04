import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { loadTroncoBySession } from '@/lib/tronco-server';
import { overviewScope } from '@/lib/overview-roles';
import { NextResponse } from 'next/server';

// Total do Tronco de UMA sessão (confirmado, aguardando e divisão por origem), sem doador. Visível a todos os cargos de gestão
// (decisão do dono, 2026-10-04: todos veem o total por sessão e o fundo; só confirmar é do Tesoureiro, Venerável e Administrador).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!overviewScope(session.user.role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const { id } = await params;
  const [row] = await withTenant(String(lodgeId), (db) => loadTroncoBySession(db, String(lodgeId), { sessionIds: [id] }));
  return NextResponse.json({ confirmed: row?.confirmed ?? 0, pending: row?.pending ?? 0, bySource: row?.bySource ?? { members: 0, visitors: 0, mixed: 0 } });
}
