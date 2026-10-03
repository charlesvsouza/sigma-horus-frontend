import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { MAX_RENEW_REPETITIONS, renewMothers } from '@/lib/recurring-renewal';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Renova o período das cobranças recorrentes que estão acabando (Cobranças → "Recorrências chegando ao fim"):
// as mães escolhidas ganham mais `repetitions` ocorrências, com o mesmo valor e intervalo. Só Tesoureiro/Administrador.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  const repetitions = Math.trunc(Number(body.repetitions));
  if (ids.length === 0) return NextResponse.json({ error: 'Escolha ao menos uma recorrência para renovar.' }, { status: 400 });
  if (!(repetitions >= 1 && repetitions <= MAX_RENEW_REPETITIONS)) {
    return NextResponse.json({ error: `Informe de 1 a ${MAX_RENEW_REPETITIONS} repetições (meses, no caso de mensalidade).` }, { status: 400 });
  }
  const result = await withTenant(String(lodgeId), (db) => renewMothers(db, String(lodgeId), ids, repetitions, String(session.user.id)));
  return NextResponse.json(result);
}
