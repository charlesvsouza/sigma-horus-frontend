import { logAudit } from '@/lib/audit';
import { adminEmails, memberEmailIsAdminMessage, normalizeEmail } from '@/lib/admin-policy';
import { CANDIDATE_STATUS, parseProcessPatch } from '@/lib/candidate';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { CANDIDATE_INCLUDE, candidateAccess, parseCandidateFields } from './shared';

export async function GET() {
  const gate = await candidateAccess('read');
  if (!gate.ok) return gate.res;
  const items = await withTenant(gate.lodgeId, (db) =>
    db.member.findMany({
      where: { lodgeId: gate.lodgeId, status: CANDIDATE_STATUS },
      include: CANDIDATE_INCLUDE,
      orderBy: { name: 'asc' },
    }),
  );
  return NextResponse.json({ items });
}

// Cadastra o candidato: Member com status 'candidate' + o processo (vazio ou
// já com a pré-proposta e o proponente, se vierem no body).
export async function POST(request: Request) {
  const gate = await candidateAccess('write');
  if (!gate.ok) return gate.res;
  const { lodgeId, session } = gate;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const fields = parseCandidateFields(body);
  if (!fields.name) return NextResponse.json({ error: 'Nome do candidato é obrigatório.' }, { status: 400 });
  const parsed = parseProcessPatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const email = normalizeEmail(fields.email);
  if (email && (await adminEmails(lodgeId)).includes(email)) {
    return NextResponse.json({ error: memberEmailIsAdminMessage() }, { status: 409 });
  }

  const item = await withTenant(lodgeId, async (db) => {
    if (parsed.patch.proposerId) {
      const proposer = await db.member.findFirst({ where: { id: parsed.patch.proposerId, lodgeId, status: { not: CANDIDATE_STATUS } }, select: { id: true } });
      if (!proposer) return null;
    }
    const created = await db.member.create({
      data: {
        lodgeId,
        ...fields,
        name: String(fields.name),
        status: CANDIDATE_STATUS,
        candidateProcess: { create: { lodgeId, ...parsed.patch } },
      },
      include: CANDIDATE_INCLUDE,
    });
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'CREATE', entity: 'candidate', entityId: created.id, metadata: { name: created.name } });
    return created;
  });
  if (!item) return NextResponse.json({ error: 'Proponente não encontrado entre os obreiros da loja.' }, { status: 400 });
  return NextResponse.json({ item });
}
