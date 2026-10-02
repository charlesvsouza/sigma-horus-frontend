import { logAudit } from '@/lib/audit';
import { invalidateSessionUser } from '@/app/api/auth/[...nextauth]/auth';
import { CANDIDATE_ROLE, CANDIDATE_STATUS, admissionKindOf, canInitiate } from '@/lib/candidate';
import type { Prisma } from '@/generated/prisma/client';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { candidateAccess } from '../../shared';

type Ctx = { params: Promise<{ id: string }> };

// Registra a admissão (rota única para os dois tipos de processo):
//  - iniciação: o candidato vira obreiro ATIVO (Aprendiz — o grau é derivado da
//    data de iniciação, ver lib/masonic-degree), iniciado nesta data e nesta loja;
//  - filiação: maçom de outra loja — o cadastro recebe a história maçônica que ele
//    traz (iniciação obrigatória; elevação/exaltação e lojas quando houver) e a loja
//    de origem; `initiatedAt` do processo guarda a data da filiação.
// Nos dois casos o login, se existir, passa de 'candidate' para 'member' (a sessão
// relê o papel do banco). Cobranças e pagamentos continuam no mesmo cadastro.
const DAY = 24 * 60 * 60 * 1000;
function parseDay(v: unknown): Date | null | 'invalid' {
  const s = v == null ? '' : String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1900 || d.getTime() > Date.now() + DAY) return 'invalid';
  return d;
}
const text = (v: unknown) => String(v ?? '').trim() || null;

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const gate = await candidateAccess('write');
  if (!gate.ok) return gate.res;
  const { lodgeId, session } = gate;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const admittedAt = parseDay(body?.initiatedAt);
  if (!admittedAt || admittedAt === 'invalid') {
    return NextResponse.json({ error: 'Informe a data (não pode ser futura).' }, { status: 400 });
  }

  const result = await withTenant(lodgeId, async (db) => {
    const member = await db.member.findFirst({ where: { id, lodgeId, status: CANDIDATE_STATUS }, select: { name: true, candidateProcess: true } });
    if (!member?.candidateProcess) return { status: 404 as const, error: 'Candidato não encontrado.' };
    const kind = admissionKindOf(member.candidateProcess.admissionKind);
    const check = canInitiate(member.candidateProcess, kind);
    if (!check.ok) return { status: 409 as const, error: check.error };
    const lodge = await db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true } });

    let data: Prisma.MemberUpdateInput;
    if (kind === 'affiliation') {
      const initiationDate = parseDay(body?.initiationDate);
      const elevationDate = parseDay(body?.elevationDate);
      const exaltationDate = parseDay(body?.exaltationDate);
      if (!initiationDate || initiationDate === 'invalid') return { status: 400 as const, error: 'Informe a data de iniciação do irmão (na loja de origem).' };
      if (elevationDate === 'invalid' || exaltationDate === 'invalid') return { status: 400 as const, error: 'Data de elevação ou exaltação inválida.' };
      if (exaltationDate && !elevationDate) return { status: 400 as const, error: 'Com exaltação, informe também a elevação.' };
      if ((elevationDate && elevationDate < initiationDate) || (exaltationDate && elevationDate && exaltationDate < elevationDate)) {
        return { status: 400 as const, error: 'As datas devem seguir a ordem iniciação → elevação → exaltação.' };
      }
      data = {
        status: 'active',
        initiationDate, initiationLodge: text(body?.initiationLodge),
        elevationDate, elevationLodge: elevationDate ? text(body?.elevationLodge) : null,
        exaltationDate, exaltationLodge: exaltationDate ? text(body?.exaltationLodge) : null,
        originLodge: text(body?.originLodge),
        candidateProcess: { update: { initiatedAt: admittedAt } },
      };
    } else {
      data = {
        status: 'active',
        initiationDate: admittedAt,
        initiationLodge: text(body?.initiationLodge) ?? lodge?.name ?? null,
        candidateProcess: { update: { initiatedAt: admittedAt } },
      };
    }
    await db.member.update({ where: { id }, data });
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'UPDATE', entity: 'candidate', entityId: id, metadata: { [kind === 'affiliation' ? 'affiliated' : 'initiated']: admittedAt.toISOString().slice(0, 10), name: member.name } });
    return { status: 200 as const };
  });
  if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });

  // Fora da transação do tenant: User é escrito pelo cliente admin (padrão do projeto).
  await prismaAdmin.user.updateMany({ where: { memberId: id, lodgeId, role: CANDIDATE_ROLE }, data: { role: 'member' } });
  // A sessão relê o papel com cache curto por instância: limpa já, como em Usuários & acessos.
  for (const u of await prismaAdmin.user.findMany({ where: { memberId: id, lodgeId }, select: { id: true } })) invalidateSessionUser(u.id);
  return NextResponse.json({ ok: true });
}
