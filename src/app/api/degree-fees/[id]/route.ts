import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { degreeFeeAccess, parseDate } from '../shared';

type Ctx = { params: Promise<{ id: string }> };

// Data prevista do evento (quando a loja marcar a iniciação/elevação/exaltação) e observações.
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const gate = await degreeFeeAccess('write');
  if (!gate.ok) return gate.res;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const data: { expectedEventDate?: Date | null; notes?: string | null } = {};
  if ('expectedEventDate' in body) {
    const d = parseDate(body.expectedEventDate);
    if (d === undefined) return NextResponse.json({ error: 'Data prevista inválida.' }, { status: 400 });
    data.expectedEventDate = d;
  }
  if ('notes' in body) data.notes = String(body.notes ?? '').trim() || null;
  const ok = await withTenant(gate.lodgeId, async (db) => {
    const plan = await db.degreeFeePlan.findFirst({ where: { id, lodgeId: gate.lodgeId, status: 'active' }, select: { id: true } });
    if (!plan) return false;
    await db.degreeFeePlan.update({ where: { id }, data });
    await logAudit(db, {
      lodgeId: gate.lodgeId, userId: gate.session.user.id, action: 'UPDATE', entity: 'degreeFeePlan', entityId: id,
      metadata: { fields: Object.keys(data), expectedEventDate: data.expectedEventDate?.toISOString().slice(0, 10) ?? null },
    });
    return true;
  });
  if (!ok) return NextResponse.json({ error: 'Plano ativo não encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
