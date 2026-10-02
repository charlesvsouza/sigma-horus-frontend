import { logAudit } from '@/lib/audit';
import { adminEmails, memberEmailIsAdminMessage, normalizeEmail } from '@/lib/admin-policy';
import { CANDIDATE_ROLE, CANDIDATE_STATUS, parseProcessPatch } from '@/lib/candidate';
import { CANDIDACY_DOCUMENT_CATEGORY } from '@/lib/documents';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { CANDIDATE_INCLUDE, candidateAccess, parseCandidateFields } from '../shared';

type Ctx = { params: Promise<{ id: string }> };

// Ficha do candidato: dados, processo, sindicantes e a pasta de documentos do
// processo. Também serve para o candidato já iniciado (histórico do processo),
// por isso não filtra pelo status.
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const gate = await candidateAccess('read');
  if (!gate.ok) return gate.res;
  const result = await withTenant(gate.lodgeId, async (db) => {
    const item = await db.member.findFirst({ where: { id, lodgeId: gate.lodgeId, candidateProcess: { isNot: null } }, include: CANDIDATE_INCLUDE });
    if (!item) return null;
    const documents = await db.document.findMany({
      where: { lodgeId: gate.lodgeId, memberId: id, category: { equals: CANDIDACY_DOCUMENT_CATEGORY, mode: 'insensitive' } },
      select: { id: true, title: true, fileName: true, mimeType: true, storageKey: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return { item, documents };
  });
  if (!result) return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
  return NextResponse.json(result);
}

// Atualização parcial: dados pessoais e/ou datas do processo — só as chaves enviadas.
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const gate = await candidateAccess('write');
  if (!gate.ok) return gate.res;
  const { lodgeId, session } = gate;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const fields = parseCandidateFields(body);
  if ('name' in fields && !fields.name) return NextResponse.json({ error: 'Nome do candidato é obrigatório.' }, { status: 400 });
  const parsed = parseProcessPatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await withTenant(lodgeId, async (db) => {
    const current = await db.member.findFirst({ where: { id, lodgeId, status: CANDIDATE_STATUS }, select: { id: true, email: true, candidateProcess: { select: { id: true, closedAt: true } } } });
    if (!current?.candidateProcess) return { status: 404 as const, error: 'Candidato não encontrado.' };
    const email = normalizeEmail(fields.email);
    if (email && normalizeEmail(current.email) !== email && (await adminEmails(lodgeId)).includes(email)) {
      return { status: 409 as const, error: memberEmailIsAdminMessage() };
    }
    if (parsed.patch.proposerId) {
      const proposer = await db.member.findFirst({ where: { id: parsed.patch.proposerId, lodgeId, status: { not: CANDIDATE_STATUS } }, select: { id: true } });
      if (!proposer) return { status: 400 as const, error: 'Proponente não encontrado entre os obreiros da loja.' };
    }
    const item = await db.member.update({
      where: { id },
      data: {
        ...fields,
        ...(Object.keys(parsed.patch).length > 0 ? { candidateProcess: { update: parsed.patch } } : {}),
      },
      include: CANDIDATE_INCLUDE,
    });
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'UPDATE', entity: 'candidate', entityId: id, metadata: { fields: [...Object.keys(fields), ...Object.keys(parsed.patch)] } });
    return { status: 200 as const, item };
  });
  if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ item: result.item });
}

// Excluir só candidato sem histórico (cobranças, pagamentos, documentos) —
// com histórico, encerre o processo: a ficha fica guardada.
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const gate = await candidateAccess('write');
  if (!gate.ok) return gate.res;
  const { lodgeId, session } = gate;

  const result = await withTenant(lodgeId, async (db) => {
    const member = await db.member.findFirst({ where: { id, lodgeId, status: CANDIDATE_STATUS }, select: { id: true, name: true, user: { select: { id: true } } } });
    if (!member) return 404 as const;
    const [accounts, payments, documents] = await Promise.all([
      db.account.count({ where: { memberId: id } }),
      db.payment.count({ where: { memberId: id } }),
      db.document.count({ where: { memberId: id } }),
    ]);
    if (accounts + payments + documents > 0) return 409 as const;
    // O login do candidato (papel 'candidate') não sobrevive ao cadastro: sem ele, seria um acesso órfão.
    await prismaAdmin.user.deleteMany({ where: { memberId: id, lodgeId, role: CANDIDATE_ROLE } });
    await db.member.delete({ where: { id } });
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'DELETE', entity: 'candidate', entityId: id, metadata: { name: member.name } });
    return 200 as const;
  });
  if (result === 404) return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
  if (result === 409) {
    return NextResponse.json({ error: 'Este candidato tem lançamentos, pagamentos ou documentos e não pode ser excluído. Encerre o processo em vez de excluir.' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
