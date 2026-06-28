import { auth } from '@/lib/auth';
import { prismaAdmin } from '@/lib/prisma';
import { normalizeRole, ROLES } from '@/lib/rbac';
import { generateTempPassword } from '@/lib/password';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Admin ajusta papel/status de um usuário, ou reemite a senha provisória.
// O "cargo" (papel de permissão) só é definido aqui — o próprio obreiro nunca
// edita o próprio papel.
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (normalizeRole(session?.user?.role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas o Administrador pode gerenciar usuários.' }, { status: 403 });
  }

  const target = await prismaAdmin.user.findFirst({
    where: { id, lodgeId: String(lodgeId) },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!target) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  // Reemitir senha provisória
  if (body.action === 'reset-password') {
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await prismaAdmin.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br';
    const result = await dispatch(
      'email',
      target.email,
      'Sua senha do Sigma Horus foi redefinida',
      `Prezado Ir∴ ${target.name},\n\nUma nova senha provisória foi gerada.\n\nEndereço: ${appUrl}/login\nUsuário: ${target.email}\nSenha provisória: ${tempPassword}\n\nVocê deverá definir uma nova senha no próximo acesso.`,
      EMPTY_CHANNELS,
    );
    await prismaAdmin.auditLog.create({
      data: { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'user', entityId: id, after: JSON.stringify({ resetPassword: true, emailStatus: result.status }) },
    });
    return NextResponse.json({ ok: true, emailStatus: result.status, tempPassword: result.status === 'sent' ? undefined : tempPassword });
  }

  // Ajuste de papel/status
  const data: { role?: string; status?: string } = {};
  if (typeof body.role === 'string') {
    const role = normalizeRole(body.role);
    if (!ROLES.includes(role as (typeof ROLES)[number])) {
      return NextResponse.json({ error: 'Papel inválido.' }, { status: 400 });
    }
    // Trava de segurança: não permitir remover o último administrador da loja.
    if (target.role === 'admin' && role !== 'admin') {
      const admins = await prismaAdmin.user.count({ where: { lodgeId: String(lodgeId), role: 'admin', status: 'active' } });
      if (admins <= 1) {
        return NextResponse.json({ error: 'A loja precisa de pelo menos um Administrador.' }, { status: 409 });
      }
    }
    data.role = role;
  }
  if (typeof body.status === 'string' && ['active', 'inactive'].includes(body.status)) {
    data.status = body.status;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
  }

  const updated = await prismaAdmin.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, status: true, memberId: true },
  });
  await prismaAdmin.auditLog.create({
    data: { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'user', entityId: id, after: JSON.stringify(data) },
  });
  return NextResponse.json({ item: updated });
}
