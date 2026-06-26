import { randomBytes } from 'crypto';
import { prismaAdmin } from '@/lib/prisma';

export const INVITE_TTL_DAYS = 14;

/** Código legível e único: SH-XXXXXXXX (sem caracteres ambíguos). */
export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return `SH-${out}`;
}

export async function createInvite(opts: { email?: string; note?: string; ttlDays?: number }) {
  const code = generateInviteCode();
  const ttl = opts.ttlDays ?? INVITE_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);
  return prismaAdmin.invitation.create({
    data: {
      code,
      email: opts.email?.trim().toLowerCase() || null,
      note: opts.note?.trim() || null,
      status: 'pending',
      expiresAt,
    },
  });
}

type InviteCheck =
  | { ok: true; invite: Awaited<ReturnType<typeof createInvite>> }
  | { ok: false; reason: 'not_found' | 'used' | 'revoked' | 'expired' };

/** Valida um código sem consumir. */
export async function validateInvite(code: string): Promise<InviteCheck> {
  const normalized = code.trim().toUpperCase();
  const invite = await prismaAdmin.invitation.findUnique({ where: { code: normalized } });
  if (!invite) return { ok: false, reason: 'not_found' };
  if (invite.status === 'used') return { ok: false, reason: 'used' };
  if (invite.status === 'revoked') return { ok: false, reason: 'revoked' };
  if (invite.expiresAt.getTime() < Date.now()) {
    if (invite.status !== 'expired') {
      await prismaAdmin.invitation.update({ where: { id: invite.id }, data: { status: 'expired' } });
    }
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, invite };
}

/** Consome o convite de forma atômica (idempotente por código pendente). */
export async function consumeInvite(code: string, lodgeId: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  const res = await prismaAdmin.invitation.updateMany({
    where: { code: normalized, status: 'pending', expiresAt: { gt: new Date() } },
    data: { status: 'used', usedAt: new Date(), lodgeId },
  });
  return res.count === 1;
}

export const INVITE_ERROR_MESSAGES: Record<string, string> = {
  not_found: 'Convite inválido. Verifique o código recebido.',
  used: 'Este convite já foi utilizado.',
  revoked: 'Este convite foi cancelado.',
  expired: 'Este convite expirou. Solicite um novo.',
  missing: 'O cadastro é por convite. Informe um código de convite válido.',
};
