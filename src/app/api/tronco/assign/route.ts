import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { isTroncoSource } from '@/lib/tronco-session';
import { assignTroncoToSession } from '@/lib/tronco-server';
import { NextResponse } from 'next/server';

// "Atribuir à sessão": liga uma entrada do Tronco já lançada (sem sessão) a uma sessão e guarda a origem do dinheiro.
// Só Tesoureiro, Venerável e Administrador (a regra do cargo fica em assignTroncoToSession).
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sub = await requireActiveSubscription(String(lodgeId));
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: sub.status });
  const body = await request.json().catch(() => ({}));
  const paymentId = String(body?.paymentId ?? '');
  const sessionId = body?.sessionId ? String(body.sessionId) : null;
  const sessionDate = body?.sessionDate ? String(body.sessionDate) : null;
  const source = isTroncoSource(body?.source) ? body.source : undefined;
  if (!paymentId) return NextResponse.json({ error: 'Informe a entrada do Tronco.' }, { status: 400 });
  const result = await withTenant(String(lodgeId), (db) =>
    assignTroncoToSession(db, String(lodgeId), { id: String(session.user.id), name: String(session.user.name ?? 'Usuário'), role: session.user.role }, { paymentId, sessionId, sessionDate, source }),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
