import { NextResponse } from 'next/server';
import { withTenant } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { undoLegacyBatch } from '@/lib/legacy-import/commit';
import { resolveActor } from '../shared';
import { requireActiveSubscription } from '@/lib/subscription-guard';

// Desfaz um lote importado: remove só o que ele criou (marca [import:legacy:<lote>]).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const batchId = typeof body?.batchId === 'string' ? body.batchId.trim() : '';
  if (!/^[a-z0-9]{4,32}$/i.test(batchId)) return NextResponse.json({ error: 'Lote inválido.' }, { status: 400 });

  const actor = await resolveActor(request, typeof body?.lodgeId === 'string' ? body.lodgeId : null);
  if ('error' in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });
  const subscription = await requireActiveSubscription(actor.lodgeId);
  if (!subscription.ok) return NextResponse.json({ error: subscription.error, code: subscription.code }, { status: subscription.status });

  const removed = await withTenant(actor.lodgeId, async (db) => {
    const res = await undoLegacyBatch(db, actor.lodgeId, batchId);
    await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'DELETE', entity: 'legacy_import', entityId: batchId, metadata: res });
    return res;
  });
  return NextResponse.json({ ok: true, removed });
}
