import { auth } from '@/lib/auth';
import { prismaAdmin } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { generateTempPassword } from '@/lib/password';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { requireActiveSubscription } from '@/lib/subscription-guard';

type Ctx = { params: Promise<{ id: string }> };

// Concede acesso ao sistema a um membro: cria (ou recria a senha de) um User
// vinculado ao membro, com login = e-mail do cadastro e senha provisória enviada
// por e-mail (Resend). O obreiro troca a senha no 1º acesso (mustChangePassword).
// Apenas o Administrador da loja executa.
export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const subscription = await requireActiveSubscription(String(lodgeId));
  if (!subscription.ok) return NextResponse.json({ error: subscription.error, code: subscription.code }, { status: subscription.status });
  if (normalizeRole(session?.user?.role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas o Administrador pode conceder acesso.' }, { status: 403 });
  }

  const member = await prismaAdmin.member.findFirst({
    where: { id, lodgeId: String(lodgeId) },
    select: { id: true, name: true, email: true },
  });
  if (!member) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });

  const email = (member.email || '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Cadastre um e-mail no membro antes de conceder acesso.' }, { status: 400 });
  }

  // E-mail já usado por outro usuário (de outra pessoa)? Bloqueia.
  const emailOwner = await prismaAdmin.user.findUnique({ where: { email }, select: { id: true, memberId: true, lodgeId: true, role: true } });
  // Usuário de OUTRA loja com esse e-mail: nunca religar (isso religaria memberId sem
  // atualizar lodgeId, sequestrando a conta e misturando contexto entre tenants).
  if (emailOwner && emailOwner.lodgeId !== String(lodgeId)) {
    return NextResponse.json({ error: 'Este e-mail já pertence a um usuário de outra loja.' }, { status: 409 });
  }
  // Um e-mail, um papel: e-mail de outro usuário (inclusive o do Administrador) nunca é religado ao
  // obreiro — antes, o usuário existente com esse e-mail era vinculado ao membro e os papéis se misturavam.
  if (emailOwner && emailOwner.memberId !== member.id) {
    const isAdminOwner = emailOwner.role === 'admin';
    return NextResponse.json({
      error: isAdminOwner
        ? 'Este e-mail é o do Administrador da loja. Cadastre no obreiro um e-mail diferente: os papéis não se confundem.'
        : 'Este e-mail já pertence a outro usuário.',
    }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const existing = await prismaAdmin.user.findFirst({ where: { memberId: member.id }, select: { id: true, role: true } });
  if (existing?.role === 'admin') {
    return NextResponse.json({ error: 'Este cadastro está ligado a um usuário Administrador. O Administrador não é reemitido por aqui — use Usuários & acessos.' }, { status: 409 });
  }
  if (existing) {
    await prismaAdmin.user.update({
      where: { id: existing.id },
      data: { passwordHash, mustChangePassword: true, status: 'active', email, name: member.name },
    });
  } else {
    await prismaAdmin.user.create({
      data: {
        name: member.name,
        email,
        passwordHash,
        role: 'member',
        lodgeId: String(lodgeId),
        memberId: member.id,
        mustChangePassword: true,
      },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br';
  const subject = 'Seu acesso ao Sigma Horus';
  const body = [
    `Prezado Ir∴ ${member.name},`,
    '',
    'Seu acesso ao sistema da loja foi liberado.',
    '',
    `Endereço: ${appUrl}/login`,
    `Usuário (e-mail): ${email}`,
    `Senha provisória: ${tempPassword}`,
    '',
    'Por segurança, você deverá definir uma nova senha no primeiro acesso.',
    '',
    'T∴F∴A∴',
  ].join('\n');

  const result = await dispatch('email', email, subject, body, EMPTY_CHANNELS);

  await prismaAdmin.messageLog.create({
    data: {
      lodgeId: String(lodgeId),
      memberId: member.id,
      channel: 'email',
      title: subject,
      content: 'Senha provisória de acesso (conteúdo omitido).',
      status: result.status,
      error: result.detail ?? null,
    },
  });

  await prismaAdmin.auditLog.create({
    data: {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: existing ? 'UPDATE' : 'CREATE',
      entity: 'user',
      entityId: member.id,
      after: JSON.stringify({ grantedAccess: true, email, emailStatus: result.status }),
    },
  });

  return NextResponse.json({
    ok: true,
    emailStatus: result.status,
    // Só devolve a senha em claro se o e-mail NÃO saiu (para o admin repassar manualmente).
    tempPassword: result.status === 'sent' ? undefined : tempPassword,
    detail: result.detail,
  });
}
