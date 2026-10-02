import { logAudit } from '@/lib/audit';
import { CANDIDATE_STATUS, OPINIONS } from '@/lib/candidate';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { CANDIDATE_INCLUDE, candidateAccess } from '../../shared';

type Ctx = { params: Promise<{ id: string }> };

interface InquirerInput { memberId: string; opinion: string | null; reportedAt: Date | null }

function parseInquirers(body: Record<string, unknown>): { ok: true; list: InquirerInput[] } | { ok: false; error: string } {
  const raw = Array.isArray(body?.inquirers) ? (body.inquirers as Record<string, unknown>[]) : null;
  if (!raw) return { ok: false, error: 'Lista de sindicantes ausente.' };
  const seen = new Set<string>();
  const list: InquirerInput[] = [];
  for (const r of raw) {
    const memberId = String(r?.memberId ?? '').trim();
    if (!memberId || seen.has(memberId)) continue;
    seen.add(memberId);
    const opinion = r?.opinion ? String(r.opinion) : null;
    if (opinion && !OPINIONS.some((o) => o.value === opinion)) return { ok: false, error: 'Parecer inválido.' };
    const reportedAt = r?.reportedAt ? new Date(String(r.reportedAt)) : null;
    if (reportedAt && Number.isNaN(reportedAt.getTime())) return { ok: false, error: 'Data do parecer inválida.' };
    list.push({ memberId, opinion, reportedAt });
  }
  return { ok: true, list };
}

// Sindicantes do processo (substitui a lista inteira): obreiros da loja, com o
// parecer e a data de cada um. O próprio candidato e o proponente não podem
// ser sindicantes.
export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const gate = await candidateAccess('write');
  if (!gate.ok) return gate.res;
  const { lodgeId, session } = gate;

  const parsed = parseInquirers((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await withTenant(lodgeId, async (db) => {
    const candidate = await db.member.findFirst({ where: { id, lodgeId, status: CANDIDATE_STATUS }, select: { candidateProcess: { select: { id: true, proposerId: true } } } });
    const process = candidate?.candidateProcess;
    if (!process) return { status: 404 as const, error: 'Candidato não encontrado.' };
    const ids = parsed.list.map((i) => i.memberId);
    if (ids.includes(id) || (process.proposerId && ids.includes(process.proposerId))) {
      return { status: 400 as const, error: 'O candidato e o proponente não podem ser sindicantes.' };
    }
    const valid = await db.member.count({ where: { lodgeId, id: { in: ids }, status: { not: CANDIDATE_STATUS } } });
    if (valid !== ids.length) return { status: 400 as const, error: 'Sindicante não encontrado entre os obreiros da loja.' };

    await db.candidateInquirer.deleteMany({ where: { processId: process.id } });
    if (parsed.list.length > 0) {
      await db.candidateInquirer.createMany({ data: parsed.list.map((i) => ({ lodgeId, processId: process.id, ...i })) });
    }
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'UPDATE', entity: 'candidate', entityId: id, metadata: { inquirers: parsed.list.length } });
    const item = await db.member.findUnique({ where: { id }, include: CANDIDATE_INCLUDE });
    return { status: 200 as const, item };
  });
  if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ item: result.item });
}
