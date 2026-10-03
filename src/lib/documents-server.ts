import type { Prisma } from '@/generated/prisma/client';
import { canLodgeAccess, normalizeRole } from '@/lib/rbac';
import { memberDocumentRank, type DocumentViewer } from '@/lib/documents';

/** Quem está olhando: se vê tudo (documents:write), se é papel Membro e o grau dele (das datas de evolução). */
export async function loadDocumentViewer(
  db: Prisma.TransactionClient,
  lodgeId: string,
  session: { user?: { role?: string | null; memberId?: string | null } | null } | null,
): Promise<DocumentViewer> {
  const role = session?.user?.role;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  const seesAll = await canLodgeAccess(lodgeId, role, 'documents', 'write');
  const member = memberId
    ? await db.member.findFirst({ where: { id: memberId, lodgeId }, select: { initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true } })
    : null;
  return { seesAll, isCandidate: normalizeRole(role) === 'candidate', isMemberRole: normalizeRole(role) === 'member', memberId, rank: memberDocumentRank(member) };
}
