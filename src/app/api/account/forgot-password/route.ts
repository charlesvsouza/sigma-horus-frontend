import { prismaAdmin } from '@/lib/prisma';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { signResetToken } from '@/lib/reset-token';
import { NextResponse } from 'next/server';

// Recuperação de senha self-service (público). Dado um e-mail, se houver um
// usuário ativo, envia por e-mail (Resend) um LINK de redefinição (válido por 1h,
// uso único). A senha atual NÃO é alterada aqui — só quando o dono do e-mail abre
// o link e define uma nova em /redefinir-senha. Quem apenas sabe o e-mail de
// alguém não consegue trancá-lo para fora. Resposta é SEMPRE 200 e genérica
// (anti-enumeração) e há limite de pedidos por conta.
const MAX_REQUESTS = 3;
const WINDOW_MS = 15 * 60_000;

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
    select: { id: true, name: true, lodgeId: true, memberId: true, status: true, passwordHash: true, lodge: { select: { status: true } } },
  });
  if (!user || user.status !== 'active' || user.lodge?.status !== 'active') return generic;

  // Limite por conta (contagem via MessageLog, sem tabela nova): evita usar a
  // rota para encher a caixa de entrada de alguém.
  const marker = `Link de redefinição de senha (user ${user.id})`;
  const recent = await prismaAdmin.messageLog.count({
    where: { lodgeId: user.lodgeId, content: marker, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
  if (recent >= MAX_REQUESTS) return generic;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br';
  const link = `${appUrl}/redefinir-senha?token=${encodeURIComponent(signResetToken(user.id, user.passwordHash))}`;
  const subject = 'Redefinição de senha — Sigma Horus';
  const message = [
    `Prezado Ir∴ ${user.name},`,
    '',
    'Recebemos um pedido de redefinição de senha da sua conta.',
    '',
    'Para definir uma nova senha, abra o link abaixo (vale por 1 hora e só pode ser usado uma vez):',
    link,
    '',
    'Se não foi você quem pediu, ignore este e-mail: nada foi alterado e a sua senha atual continua a mesma.',
    '',
    'T∴F∴A∴',
  ].join('\n');

  const result = await dispatch('email', email, subject, message, EMPTY_CHANNELS);

  await prismaAdmin.messageLog.create({
    data: {
      lodgeId: user.lodgeId,
      memberId: user.memberId ?? null,
      channel: 'email',
      title: subject,
      content: marker,
      status: result.status,
      error: result.detail ?? null,
    },
  });
  await prismaAdmin.auditLog.create({
    data: {
      lodgeId: user.lodgeId,
      userId: user.id,
      action: 'CREATE',
      entity: 'password_reset_requested',
      entityId: user.id,
      after: JSON.stringify({ via: 'forgot-password', emailStatus: result.status }),
    },
  });

  return generic;
}
