import { createDegreeFeePlan, emitCardInstallment, PLAN_INCLUDE, presentPlan } from '@/lib/degree-fee-server';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { degreeFeeAccess, parseDate } from './shared';

export async function GET() {
  const gate = await degreeFeeAccess('read');
  if (!gate.ok) return gate.res;
  const plans = await withTenant(gate.lodgeId, (db) =>
    db.degreeFeePlan.findMany({ where: { lodgeId: gate.lodgeId }, include: PLAN_INCLUDE, orderBy: { createdAt: 'desc' } }),
  );
  return NextResponse.json({ items: plans.map((p) => presentPlan(p)) });
}

export async function POST(request: Request) {
  const gate = await degreeFeeAccess('write');
  if (!gate.ok) return gate.res;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const firstDueDate = parseDate(body.firstDueDate);
  const fourth = parseDate(body.fourthInstructionDate);
  if (!firstDueDate) return NextResponse.json({ error: 'Informe o vencimento da 1ª cota.' }, { status: 400 });
  if (fourth === undefined) return NextResponse.json({ error: 'Data da 4ª instrução inválida.' }, { status: 400 });
  const result = await withTenant(gate.lodgeId, (db) =>
    createDegreeFeePlan(db, {
      lodgeId: gate.lodgeId,
      userId: gate.session.user.id,
      memberId: String(body.memberId ?? ''),
      kind: String(body.kind ?? ''),
      installments: Number(body.installments),
      firstDueDate,
      fourthInstructionDate: fourth,
      notes: body.notes ? String(body.notes) : null,
      paymentMethod: body.paymentMethod === 'card' ? 'card' : 'standard',
    }),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  // Cartão: emite o parcelamento no Asaas agora (rede fora da transação); se falhar, o plano é desfeito.
  if (body.paymentMethod === 'card') {
    const emitted = await emitCardInstallment(gate.lodgeId, result.planId);
    if (!emitted.ok) return NextResponse.json({ error: emitted.error }, { status: emitted.status });
    return NextResponse.json({ id: result.planId, cardUrl: emitted.url });
  }
  return NextResponse.json({ id: result.planId });
}
