import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { normalizeRole, requireLodgeAccess } from '@/lib/rbac';
import { closeRectification, decideRectification } from '@/lib/ledger-lock-server';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// approve = "Concordo" do Venerável/Administrador (vale 48 h); reject = "Não concordo"; close = encerrar/cancelar.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const sub = await requireActiveSubscription(String(lodgeId));
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: sub.status });

  const { id } = await params;
  const body = await request.json().catch(() => undefined);
  const action = String(body?.action ?? '');
  if (!['approve', 'reject', 'close'].includes(action)) return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  const user = { id: String(session.user.id), name: String(session.user.name ?? 'Usuário'), role: normalizeRole(session?.user?.role) };

  const result = await withTenant(String(lodgeId), (db) =>
    action === 'close'
      ? closeRectification(db, { lodgeId: String(lodgeId), id, user })
      : decideRectification(db, { lodgeId: String(lodgeId), id, approve: action === 'approve', note: body?.note ? String(body.note) : null, user }),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ...(result as { ok: true; status?: string; selfApproved?: boolean }) });
}
