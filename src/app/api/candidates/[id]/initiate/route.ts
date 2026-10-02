import { logAudit } from '@/lib/audit';
import { invalidateSessionUser } from '@/app/api/auth/[...nextauth]/auth';
import { CANDIDATE_ROLE, CANDIDATE_STATUS, canInitiate } from '@/lib/candidate';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { candidateAccess } from '../../shared';

type Ctx = { params: Promise<{ id: string }> };

// Registra a iniciação: o candidato vira obreiro ATIVO (Aprendiz — o grau é
// derivado da data de iniciação, ver lib/masonic-degree) e o login dele, se
// existir, passa de 'candidate' para 'member' (a sessão relê o papel do banco).
// Cobranças e pagamentos continuam no mesmo cadastro.
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const gate = await candidateAccess('write');
  if (!gate.ok) return gate.res;
  const { lodgeId, session } = gate;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const initiatedAt = body?.initiatedAt ? new Date(String(body.initiatedAt)) : null;
  if (!initiatedAt || Number.isNaN(initiatedAt.getTime()) || initiatedAt.getUTCFullYear() < 1900 || initiatedAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Informe a data da iniciação (não pode ser futura).' }, { status: 400 });
  }
  const initiationLodge = String(body?.initiationLodge ?? '').trim() || null;

  const result = await withTenant(lodgeId, async (db) => {
    const member = await db.member.findFirst({ where: { id, lodgeId, status: CANDIDATE_STATUS }, select: { name: true, candidateProcess: true } });
    if (!member?.candidateProcess) return { status: 404 as const, error: 'Candidato não encontrado.' };
    const check = canInitiate(member.candidateProcess);
    if (!check.ok) return { status: 409 as const, error: check.error };
    const lodge = await db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true } });
    await db.member.update({
      where: { id },
      data: {
        status: 'active',
        initiationDate: initiatedAt,
        initiationLodge: initiationLodge ?? lodge?.name ?? null,
        candidateProcess: { update: { initiatedAt } },
      },
    });
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'UPDATE', entity: 'candidate', entityId: id, metadata: { initiated: initiatedAt.toISOString().slice(0, 10), name: member.name } });
    return { status: 200 as const };
  });
  if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });

  // Fora da transação do tenant: User é escrito pelo cliente admin (padrão do projeto).
  await prismaAdmin.user.updateMany({ where: { memberId: id, lodgeId, role: CANDIDATE_ROLE }, data: { role: 'member' } });
  // A sessão relê o papel com cache curto por instância: limpa já, como em Usuários & acessos.
  for (const u of await prismaAdmin.user.findMany({ where: { memberId: id, lodgeId }, select: { id: true } })) invalidateSessionUser(u.id);
  return NextResponse.json({ ok: true });
}
