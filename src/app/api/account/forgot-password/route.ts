import { prismaAdmin } from '@/lib/prisma';
import { generateTempPassword } from '@/lib/password';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

// Recuperação de senha self-service (público). Dado um e-mail, se houver um
// usuário ativo, gera uma senha provisória, envia por e-mail (Resend) e marca
// mustChangePassword — o obreiro entra com ela e define a nova no 1º acesso
// (mesma mecânica de "Conceder acesso"). Resposta é SEMPRE 200 e genérica,
// para não revelar quais e-mails existem (anti-enumeração).
export async function POST(request: Request) {
  const generic = NextResponse.json({ ok: true });

  let email = '';
  try {
    const body = await request.json();
    email = String(body?.email || '').trim().toLowerCase();
  } catch {
    return generic;
  }
  if (!email || !email.includes('@')) return generic;

  const user = await prismaAdmin.user.findUnique({
    where: { email },
    select: { id: true, name: true, lodgeId: true, memberId: true, status: true },
  });
  if (!user || user.status !== 'active') return generic;

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await prismaAdmin.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br';
  const subject = 'Redefinição de senha — Sigma Horus';
  const message = [
    `Prezado Ir∴ ${user.name},`,
    '',
    'Recebemos um pedido de redefinição de senha da sua conta.',
    '',
    `Endereço: ${appUrl}/login`,
    `Usuário (e-mail): ${email}`,
    `Senha provisória: ${tempPassword}`,
    '',
    'Por segurança, você deverá definir uma nova senha no primeiro acesso.',
    'Se não foi você quem solicitou, ignore este e-mail e a senha atual continua válida — basta não usar a provisória.',
    '',
    'T∴F∴A∴',
  ].join('\n');

  const result = await dispatch('email', email, subject, message, EMPTY_CHANNELS);

  if (user.lodgeId) {
    await prismaAdmin.messageLog.create({
      data: {
        lodgeId: user.lodgeId,
        memberId: user.memberId ?? null,
        channel: 'email',
        title: subject,
        content: 'Senha provisória de redefinição (conteúdo omitido).',
        status: result.status,
      },
    });
    await prismaAdmin.auditLog.create({
      data: {
        lodgeId: user.lodgeId,
        userId: user.id,
        action: 'UPDATE',
        entity: 'user',
        entityId: user.id,
        after: JSON.stringify({ passwordReset: true, via: 'forgot-password', emailStatus: result.status }),
      },
    });
  }

  return generic;
}
