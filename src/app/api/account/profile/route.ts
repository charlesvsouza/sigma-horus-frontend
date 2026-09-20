import { auth } from '@/lib/auth';
import { prismaAdmin } from '@/lib/prisma';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { signEmailChangeToken } from '@/lib/email-change-token';
import { adminEmailIsMemberMessage, memberUsesEmail, normalizeEmail } from '@/lib/admin-policy';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

// "Minha conta": o usuário logado edita o PRÓPRIO nome e e-mail de login. Só vale para quem NÃO é
// obreiro (sem cadastro de membro): o nome/e-mail do obreiro são os do cadastro (Meu portal). O papel
// nunca é editado aqui. Troca de e-mail: exige a senha atual e só vale depois do link enviado ao NOVO
// e-mail (o e-mail é a identidade de login).
export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prismaAdmin.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, memberId: true, lodgeId: true, passwordHash: true },
  });
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  if (user.memberId) {
    return NextResponse.json({ error: 'Seu nome e e-mail são os do seu cadastro de obreiro — altere em Meu portal → Editar meus dados.' }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const result: { nameUpdated?: boolean; emailPending?: string } = {};

  if (typeof body.name === 'string' && body.name.trim() && body.name.trim() !== user.name) {
    const name = body.name.trim();
    if (name.length < 3 || name.length > 120) return NextResponse.json({ error: 'Informe o nome completo.' }, { status: 400 });
    await prismaAdmin.user.update({ where: { id: userId }, data: { name } });
    await prismaAdmin.auditLog.create({ data: { lodgeId: user.lodgeId, userId, action: 'UPDATE', entity: 'user', entityId: userId, after: JSON.stringify({ name }) } });
    result.nameUpdated = true;
  }

  const newEmail = normalizeEmail(typeof body.newEmail === 'string' ? body.newEmail : '');
  if (newEmail && newEmail !== normalizeEmail(user.email)) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    const valid = await bcrypt.compare(String(body.currentPassword ?? ''), user.passwordHash);
    if (!valid) return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 });
    if (await prismaAdmin.user.findUnique({ where: { email: newEmail }, select: { id: true } })) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 });
    }
    if (user.role === 'admin' && (await memberUsesEmail(user.lodgeId, newEmail))) {
      return NextResponse.json({ error: adminEmailIsMemberMessage() }, { status: 409 });
    }

    const token = signEmailChangeToken(user.id, newEmail, user.passwordHash);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br';
    const sent = await dispatch(
      'email',
      newEmail,
      'Confirme o novo e-mail de acesso ao Sigma Horus',
      [
        `Prezado Ir∴ ${user.name},`,
        '',
        'Recebemos o pedido para trocar o e-mail de acesso da sua conta para este endereço.',
        `Para confirmar, abra o link (vale por 1 hora): ${appUrl}/api/account/confirm-email?token=${encodeURIComponent(token)}`,
        '',
        'Se não foi você, ignore esta mensagem: nada será alterado.',
        '',
        'T∴F∴A∴',
      ].join('\n'),
      EMPTY_CHANNELS,
    );
    if (sent.status !== 'sent') return NextResponse.json({ error: 'Não foi possível enviar o e-mail de confirmação. Tente de novo em instantes.' }, { status: 502 });
    await prismaAdmin.auditLog.create({ data: { lodgeId: user.lodgeId, userId, action: 'UPDATE', entity: 'user', entityId: userId, after: JSON.stringify({ emailChangeRequested: newEmail }) } });
    result.emailPending = newEmail;
  }

  if (!result.nameUpdated && !result.emailPending) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
  return NextResponse.json({ ok: true, ...result });
}
