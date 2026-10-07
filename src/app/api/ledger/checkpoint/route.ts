import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { normalizeRole, requireLodgeAccess } from '@/lib/rbac';
import { canConfirmCheckpoint, canDecideRectification } from '@/lib/ledger-lock';
import { confirmCheckpoint, undoCheckpoint } from '@/lib/ledger-lock-server';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// Conferência do livro com o banco: o Tesoureiro informa o saldo do BANCO de cada conta até um dia; se bater com o
// sistema, o período fica travado (só muda com retificação aprovada pelo Venerável).
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!canConfirmCheckpoint(normalizeRole(session?.user?.role))) return NextResponse.json({ error: 'Só o Tesoureiro, o Venerável Mestre e o Administrador conferem o livro com o banco.' }, { status: 403 });

  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  const informed: Record<string, number> = {};
  for (const [k, v] of Object.entries((body.balances ?? {}) as Record<string, unknown>)) {
    if (v === '' || v === null || v === undefined) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) return NextResponse.json({ error: 'Saldo informado inválido.' }, { status: 400 });
    informed[k] = n;
  }

  const result = await withTenant(
    String(lodgeId),
    (db) =>
      confirmCheckpoint(db, {
        lodgeId: String(lodgeId),
        throughKey: String(body.throughDate ?? '').slice(0, 10),
        informed,
        user: { id: String(session.user.id), name: String(session.user.name ?? 'Usuário') },
        note: body.note ? String(body.note) : null,
      }),
    { timeoutMs: 30000 },
  );
  if (!result.ok) return NextResponse.json({ error: result.error, mismatches: result.mismatches ?? [] }, { status: result.mismatches ? 422 : 400 });
  return NextResponse.json({ ok: true, throughDate: result.throughKey });
}

// Desfazer a conferência vigente: só o Venerável Mestre ou o Administrador.
export async function DELETE() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sub = await requireActiveSubscription(String(lodgeId));
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: sub.status });
  if (!canDecideRectification(normalizeRole(session?.user?.role))) return NextResponse.json({ error: 'Só o Venerável Mestre ou o Administrador desfazem a conferência.' }, { status: 403 });
  const result = await withTenant(String(lodgeId), (db) => undoCheckpoint(db, { lodgeId: String(lodgeId), user: { id: String(session.user.id), name: String(session.user.name ?? 'Usuário') } }));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
