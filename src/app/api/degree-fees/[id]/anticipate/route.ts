import { anticipateToEvent } from '@/lib/degree-fee-server';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { degreeFeeAccess } from '../../shared';

type Ctx = { params: Promise<{ id: string }> };

// Traz para a data prevista do evento as cotas em aberto que venceriam depois dela.
export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const gate = await degreeFeeAccess('write');
  if (!gate.ok) return gate.res;
  const result = await withTenant(gate.lodgeId, (db) => anticipateToEvent(db, gate.lodgeId, id, gate.session.user.id));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
