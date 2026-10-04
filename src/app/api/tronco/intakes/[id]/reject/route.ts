import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { rejectTronco } from '@/lib/tronco-server';
import { NextResponse } from 'next/server';

// Recusa uma entrada do Tronco que estava aguardando (valor que não conferiu, lançamento em duplicidade etc.), com o motivo.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sub = await requireActiveSubscription(String(lodgeId));
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: sub.status });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await withTenant(String(lodgeId), (db) =>
    rejectTronco(db, String(lodgeId), id, { id: String(session.user.id), name: String(session.user.name ?? 'Usuário'), role: session.user.role }, String(body?.reason ?? '')),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
