import { auth } from '@/lib/auth';
import { prismaAdmin } from '@/lib/prisma';
import { isStrongEnough } from '@/lib/password';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

// Troca de senha pelo próprio usuário (qualquer papel). Verifica a senha atual,
// salva o novo hash e limpa mustChangePassword. Usado também no fluxo de 1º
// acesso (senha provisória).
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const current = String(body.currentPassword || '');
  const next = String(body.newPassword || '');

  if (!isStrongEnough(next)) {
    return NextResponse.json({ error: 'A nova senha deve ter pelo menos 8 caracteres.' }, { status: 400 });
  }

  const user = await prismaAdmin.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true, lodgeId: true } });
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

  const valid = await bcrypt.compare(current, user.passwordHash);
  if (!valid) return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 });

  const passwordHash = await bcrypt.hash(next, 10);
  await prismaAdmin.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });

  await prismaAdmin.auditLog.create({
    data: { lodgeId: user.lodgeId, userId, action: 'UPDATE', entity: 'user', entityId: userId, after: JSON.stringify({ changedPassword: true }) },
  });

  return NextResponse.json({ ok: true });
}
