import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { postStatementCredits } from '@/lib/tronco-server';
import { NextResponse } from 'next/server';

// "Lançar do extrato" (Modo Loja): lança no Tronco a soma dos créditos do extrato que trazem o identificador da sessão.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sub = await requireActiveSubscription(String(lodgeId));
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: sub.status });
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body?.sessionId ?? '');
  const source = body?.source === 'visitors' ? 'visitors' : 'members';
  const bankAccountId = body?.bankAccountId ? String(body.bankAccountId) : null;
  if (!sessionId) return NextResponse.json({ error: 'Informe a sessão.' }, { status: 400 });
  const result = await withTenant(String(lodgeId), (db) =>
    postStatementCredits(db, String(lodgeId), { id: String(session.user.id), name: String(session.user.name ?? 'Usuário'), role: session.user.role }, { sessionId, source, bankAccountId }),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, total: result.total, count: result.count, paymentId: result.paymentId });
}
