import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { splitPayment, type SplitPartInput } from '@/lib/split-payment-server';
import { NextResponse } from 'next/server';

// Divide um recebimento já lançado (ex.: o saldo de abertura) em partes: outra categoria (Tronco) e/ou baixa das
// cobranças adiantadas de um irmão. `apply: false` devolve só a prévia, sem gravar. O saldo do banco não muda.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== 'object' || !Array.isArray(body.parts)) return NextResponse.json({ error: 'Informe as partes a separar.' }, { status: 400 });

  const parts: SplitPartInput[] = [];
  for (const raw of body.parts as Record<string, unknown>[]) {
    const amount = Number(raw?.amount);
    if (raw?.kind === 'category' && raw.chartAccountId) parts.push({ kind: 'category', chartAccountId: String(raw.chartAccountId), amount, title: raw.title ? String(raw.title) : undefined });
    else if (raw?.kind === 'member' && raw.memberId) parts.push({ kind: 'member', memberId: String(raw.memberId), amount, paidOn: raw.paidOn ? String(raw.paidOn).slice(0, 10) : undefined });
    else return NextResponse.json({ error: 'Parte inválida: escolha uma categoria ou um irmão.' }, { status: 400 });
  }
  const apply = body.apply === true;

  const result = await withTenant(
    String(lodgeId),
    async (db) => {
      const r = await splitPayment(db, { lodgeId: String(lodgeId), paymentId: id, parts, note: body.note ? String(body.note) : null, user: { id: String(session.user.id) }, apply });
      if (r.ok && r.applied) {
        await logAudit(db, {
          lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'payment-split', entityId: id,
          metadata: { total: r.plan.total, leftover: r.plan.leftover, lines: r.plan.lines.map((l) => ({ kind: l.kind, label: l.label, amount: l.amount, accounts: l.allocations?.map((a) => a.accountId) })) },
        });
      }
      return r;
    },
    { timeoutMs: 30000 },
  );

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, applied: result.applied, plan: result.plan });
}
