import { prismaAdmin } from '@/lib/prisma';
import { readEmailChangeToken, verifyEmailChangeToken } from '@/lib/email-change-token';
import { memberUsesEmail } from '@/lib/admin-policy';
import { NextResponse } from 'next/server';

// Confirma a troca de e-mail pelo link enviado ao novo endereço. Revalida tudo no momento do clique
// (o e-mail pode ter sido tomado, ou um membro pode ter passado a usá-lo, no intervalo).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?emailChange=${reason}`, url.origin));

  const parsed = readEmailChangeToken(token);
  if (!parsed) return fail('invalid');
  const user = await prismaAdmin.user.findUnique({ where: { id: parsed.userId }, select: { id: true, role: true, memberId: true, lodgeId: true, passwordHash: true } });
  if (!user || user.memberId || !verifyEmailChangeToken(token, user.passwordHash)) return fail('invalid');
  if (await prismaAdmin.user.findUnique({ where: { email: parsed.newEmail }, select: { id: true } })) return fail('taken');
  if (user.role === 'admin' && (await memberUsesEmail(user.lodgeId, parsed.newEmail))) return fail('taken');

  await prismaAdmin.user.update({ where: { id: user.id }, data: { email: parsed.newEmail } });
  await prismaAdmin.auditLog.create({ data: { lodgeId: user.lodgeId, userId: user.id, action: 'UPDATE', entity: 'user', entityId: user.id, after: JSON.stringify({ emailChanged: parsed.newEmail }) } });
  return NextResponse.redirect(new URL('/login?emailChange=ok', url.origin));
}
