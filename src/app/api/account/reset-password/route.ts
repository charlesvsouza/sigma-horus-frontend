import { prismaAdmin } from '@/lib/prisma';
import { isStrongEnough } from '@/lib/password';
import { readResetTokenUser, verifyResetToken } from '@/lib/reset-token';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

// Conclui a redefinição: valida o link (assinatura + validade + ainda vinculado
// à senha atual) e grava a nova senha. Mensagem de erro única para não revelar
// se o usuário existe.
export async function POST(request: Request) {
  const invalid = () => NextResponse.json({ error: 'Link inválido ou expirado. Peça um novo em "Esqueceu a senha?".' }, { status: 400 });

  let token = '';
  let password = '';
  try {
    const body = await request.json();
    token = String(body?.token ?? '');
    password = String(body?.password ?? '');
  } catch {
    return invalid();
  }

  const userId = readResetTokenUser(token);
  if (!userId) return invalid();

  const user = await prismaAdmin.user.findUnique({
    where: { id: userId },
    select: { id: true, lodgeId: true, status: true, passwordHash: true, lodge: { select: { status: true } } },
  });
  if (!user || user.status !== 'active' || user.lodge?.status !== 'active') return invalid();
  if (!verifyResetToken(token, user.passwordHash)) return invalid();

  if (!isStrongEnough(password)) {
    return NextResponse.json({ error: 'A nova senha deve ter pelo menos 8 caracteres.' }, { status: 400 });
  }

  await prismaAdmin.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: false },
  });
  await prismaAdmin.auditLog.create({
    data: { lodgeId: user.lodgeId, userId: user.id, action: 'UPDATE', entity: 'user', entityId: user.id, after: JSON.stringify({ passwordReset: true, via: 'reset-link' }) },
  });

  return NextResponse.json({ ok: true });
}
