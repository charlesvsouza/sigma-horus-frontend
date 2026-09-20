import { auth } from '@/lib/auth';
import { prismaAdmin } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { generateTempPassword } from '@/lib/password';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { activeAdminCount, adminEmailIsMemberMessage, checkAdminCap, memberUsesEmail, normalizeEmail } from '@/lib/admin-policy';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { requireActiveSubscription } from '@/lib/subscription-guard';

// Gestão de usuários da loja (apenas Administrador). Lista os logins e o papel
// de cada um. A criação de login do obreiro é feita por "Conceder acesso" no
// cadastro do membro; aqui o admin ajusta status e cria outro Administrador.
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });
  if (normalizeRole(session?.user?.role) !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  const items = await prismaAdmin.user.findMany({
    where: { lodgeId: String(lodgeId) },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      memberId: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ items });
}

// Cria outro Administrador (só o Administrador). Sem vínculo com cadastro de membro e com e-mail
// PRÓPRIO — nunca o de um obreiro da loja. Senha provisória por e-mail, troca obrigatória no 1º acesso.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const subscription = await requireActiveSubscription(String(lodgeId));
  if (!subscription.ok) return NextResponse.json({ error: subscription.error, code: subscription.code }, { status: subscription.status });
  if (normalizeRole(session.user.role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas o Administrador pode criar outro Administrador.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? '').trim();
  const email = normalizeEmail(String(body?.email ?? ''));
  if (name.length < 3) return NextResponse.json({ error: 'Informe o nome completo.' }, { status: 400 });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });

  const cap = checkAdminCap(await activeAdminCount(lodgeId));
  if (!cap.ok) return NextResponse.json({ error: cap.error }, { status: 409 });

  if (await memberUsesEmail(lodgeId, email)) return NextResponse.json({ error: adminEmailIsMemberMessage() }, { status: 409 });
  if (await prismaAdmin.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const created = await prismaAdmin.user.create({
    data: { name, email, passwordHash, role: 'admin', lodgeId, mustChangePassword: true },
    select: { id: true, name: true, email: true, role: true, status: true, memberId: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br';
  const result = await dispatch(
    'email',
    email,
    'Seu acesso de Administrador ao Sigma Horus',
    [
      `Prezado Ir∴ ${name},`,
      '',
      'Você foi cadastrado como Administrador do sistema da loja.',
      '',
      `Endereço: ${appUrl}/login`,
      `Usuário (e-mail): ${email}`,
      `Senha provisória: ${tempPassword}`,
      '',
      'Por segurança, você deverá definir uma nova senha no primeiro acesso.',
      'Este login é só de Administrador; se você também é obreiro da loja, o seu acesso de obreiro continua sendo o do seu e-mail de cadastro.',
      '',
      'T∴F∴A∴',
    ].join('\n'),
    EMPTY_CHANNELS,
  );

  await prismaAdmin.auditLog.create({
    data: { lodgeId, userId: session.user.id, action: 'CREATE', entity: 'user', entityId: created.id, after: JSON.stringify({ role: 'admin', email, emailStatus: result.status }) },
  });

  return NextResponse.json({ item: created, emailStatus: result.status, tempPassword: result.status === 'sent' ? undefined : tempPassword }, { status: 201 });
}
