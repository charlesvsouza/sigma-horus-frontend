import { logAudit } from '@/lib/audit';
import { invalidateSessionUser } from '@/app/api/auth/[...nextauth]/auth';
import { CANDIDATE_ROLE, CANDIDATE_STATUS, CLOSED_REASONS } from '@/lib/candidate';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { candidateAccess } from '../../shared';

type Ctx = { params: Promise<{ id: string }> };

// Encerra o processo sem iniciação (reprovado, desistência, arquivado). O
// cadastro continua como candidato — nunca vira "obreiro inativo" — e a ficha,
// a pasta e o financeiro ficam guardados. O login do candidato é desativado.
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const gate = await candidateAccess('write');
  if (!gate.ok) return gate.res;
  const { lodgeId, session } = gate;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = String(body?.reason ?? '');
  if (!CLOSED_REASONS.some((r) => r.value === reason)) return NextResponse.json({ error: 'Escolha o motivo do encerramento.' }, { status: 400 });
  const closedAt = body?.closedAt ? new Date(String(body.closedAt)) : new Date();
  if (Number.isNaN(closedAt.getTime())) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });

  const result = await withTenant(lodgeId, async (db) => {
    const member = await db.member.findFirst({ where: { id, lodgeId, status: CANDIDATE_STATUS }, select: { candidateProcess: { select: { id: true, closedAt: true } } } });
    if (!member?.candidateProcess) return 404 as const;
    if (member.candidateProcess.closedAt) return 409 as const;
    await db.candidateProcess.update({ where: { id: member.candidateProcess.id }, data: { closedAt, closedReason: reason } });
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'UPDATE', entity: 'candidate', entityId: id, metadata: { closed: reason } });
    return 200 as const;
  });
  if (result === 404) return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
  if (result === 409) return NextResponse.json({ error: 'O processo já está encerrado.' }, { status: 409 });
  await prismaAdmin.user.updateMany({ where: { memberId: id, lodgeId, role: CANDIDATE_ROLE }, data: { status: 'inactive' } });
  for (const u of await prismaAdmin.user.findMany({ where: { memberId: id, lodgeId }, select: { id: true } })) invalidateSessionUser(u.id);
  return NextResponse.json({ ok: true });
}

// Reabre o processo encerrado (o login do candidato volta a funcionar, se existir).
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const gate = await candidateAccess('write');
  if (!gate.ok) return gate.res;
  const { lodgeId, session } = gate;

  const result = await withTenant(lodgeId, async (db) => {
    const member = await db.member.findFirst({ where: { id, lodgeId, status: CANDIDATE_STATUS }, select: { candidateProcess: { select: { id: true, closedAt: true } } } });
    if (!member?.candidateProcess) return 404 as const;
    if (!member.candidateProcess.closedAt) return 409 as const;
    await db.candidateProcess.update({ where: { id: member.candidateProcess.id }, data: { closedAt: null, closedReason: null } });
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'UPDATE', entity: 'candidate', entityId: id, metadata: { reopened: true } });
    return 200 as const;
  });
  if (result === 404) return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
  if (result === 409) return NextResponse.json({ error: 'O processo não está encerrado.' }, { status: 409 });
  await prismaAdmin.user.updateMany({ where: { memberId: id, lodgeId, role: CANDIDATE_ROLE }, data: { status: 'active' } });
  for (const u of await prismaAdmin.user.findMany({ where: { memberId: id, lodgeId }, select: { id: true } })) invalidateSessionUser(u.id);
  return NextResponse.json({ ok: true });
}
