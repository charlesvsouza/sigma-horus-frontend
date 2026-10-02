import { deletePayment } from '@/lib/asaas';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { cancelPlan, emittedOpenCotas } from '@/lib/degree-fee-server';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { degreeFeeAccess } from '../../shared';

type Ctx = { params: Promise<{ id: string }> };

// Cancela o plano (o evento não vai acontecer): cotas em aberto saem e o que já foi
// pago vira conta a pagar ao irmão (a loja devolve). Cotas já emitidas no Asaas são
// apagadas lá PRIMEIRO — se o Asaas recusar, nada muda no banco.
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const gate = await degreeFeeAccess('write');
  if (!gate.ok) return gate.res;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = String(body.reason ?? '').trim();
  if (!reason) return NextResponse.json({ error: 'Informe o motivo do cancelamento.' }, { status: 400 });

  const { emitted, lodge } = await withTenant(gate.lodgeId, async (db) => ({
    emitted: await emittedOpenCotas(db, gate.lodgeId, id),
    lodge: await db.lodge.findUnique({ where: { id: gate.lodgeId }, select: { asaasApiKeyEnc: true, asaasEnv: true } }),
  }));
  if (emitted.length > 0) {
    const config = buildLodgeAsaasConfig(lodge);
    if (!config) return NextResponse.json({ error: 'Há cotas emitidas no Asaas, mas a integração não está configurada para cancelá-las.' }, { status: 409 });
    try {
      for (const paymentId of emitted) await deletePayment(config, paymentId);
    } catch {
      return NextResponse.json({ error: 'O Asaas não cancelou uma das cotas emitidas. Tente de novo ou cancele no painel do Asaas.' }, { status: 502 });
    }
  }

  const result = await withTenant(gate.lodgeId, (db) => cancelPlan(db, { lodgeId: gate.lodgeId, planId: id, userId: gate.session.user.id, reason }));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
