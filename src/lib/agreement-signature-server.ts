import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { generateSignatureCode, hashAgreement, partyForSigner, partyLabel, type AgreementContent, type AgreementParty } from '@/lib/agreement-signature';
import { lockKey } from '@/lib/locks';
import { withTenant } from '@/lib/prisma';

type Db = Prisma.TransactionClient;

/** Conteúdo (o que foi acordado) de um acordo, a partir do banco — base do hash que a assinatura grava. */
export async function loadAgreementContent(db: Db, lodgeId: string, blockId: string): Promise<AgreementContent | null> {
  const block = await db.memberBlock.findFirst({ where: { id: blockId, lodgeId }, include: { items: true, member: { select: { id: true, name: true } } } });
  if (!block) return null;
  return {
    blockId: block.id, memberId: block.memberId, memberName: block.member.name,
    total: Number(block.total), regularizationFee: Number(block.regularizationFee), extraCharge: Number(block.extraCharge),
    installments: block.installments, firstDueDate: block.firstDueDate,
    items: block.items.map((i) => ({ kind: i.kind, title: i.title, openAmount: Number(i.openAmount), sortOrder: i.sortOrder })),
  };
}

export type SignResult = { ok: true; code: string; party: AgreementParty } | { ok: false; status: number; error: string };

/** Assina o termo do acordo vigente do irmão (open/settled) em nome da parte a que o usuário pertence. */
export async function signAgreement(
  lodgeId: string,
  memberId: string,
  user: { id: string; name: string; role: string | null | undefined; memberId: string | null | undefined },
  ip: string | null,
): Promise<SignResult> {
  const party = partyForSigner(user.role, user.memberId === memberId);
  if (!party) return { ok: false, status: 403, error: 'Só o Venerável, o Administrador, o Tesoureiro e o próprio irmão assinam este termo.' };

  return withTenant(lodgeId, async (db): Promise<SignResult> => {
    const block = await db.memberBlock.findFirst({ where: { lodgeId, memberId, status: { in: ['open', 'settled'] } }, select: { id: true } });
    if (!block) return { ok: false, status: 404, error: 'Não há acordo de regularização vigente para este irmão.' };
    await lockKey(db, `agreement-sign:${block.id}`);
    const already = await db.memberBlockSignature.findUnique({ where: { blockId_party: { blockId: block.id, party } }, select: { id: true } });
    if (already) return { ok: false, status: 409, error: 'Esta parte já assinou o termo.' };

    const content = await loadAgreementContent(db, lodgeId, block.id);
    if (!content) return { ok: false, status: 404, error: 'Acordo não encontrado.' };
    const code = generateSignatureCode();
    const signerRole = party === 'venerable' && (user.role ?? '').toLowerCase() === 'admin' ? 'Administrador' : partyLabel(party);
    await db.memberBlockSignature.create({
      data: { lodgeId, blockId: block.id, party, signerUserId: user.id, signerName: user.name, signerRole, contentHash: hashAgreement(content), code, ip: ip?.slice(0, 64) ?? null },
    });
    await logAudit(db, { lodgeId, userId: user.id, action: 'CREATE', entity: 'member-block-signature', entityId: block.id, metadata: { party, code, memberId } });
    return { ok: true, code, party };
  });
}
