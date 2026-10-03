import { sourceFromCookieHeader } from '@/lib/acquisition';
import { prismaAdmin } from '@/lib/prisma';
import { seedLodgeDefaults } from '@/lib/seed-lodge';
import { validateInvite, INVITE_ERROR_MESSAGES } from '@/lib/invites';
import { limitByIp } from '@/lib/rate-limit';
import { validateLodgeSignup } from '@/lib/validation';
import { TRIAL_DAYS, TRIAL_PLAN } from '@/lib/stripe';
import { isPlanId } from '@/lib/plans';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

class InviteTakenError extends Error {}

export async function GET() {
  return NextResponse.json({ lodge: null });
}

export async function POST(request: Request) {
  const limited = await limitByIp(request, 'lodge-signup', 20, 60 * 60_000);
  if (limited) return limited;
  const body = await request.json().catch(() => ({}));
  const acquisitionSource = sourceFromCookieHeader(request.headers.get('cookie')) ?? 'convite';
  const name = String(body?.name ?? '').trim();
  const slug = String(body?.slug ?? '').trim().toLowerCase();
  const adminName = String(body?.adminName ?? '').trim();
  const adminEmail = String(body?.adminEmail ?? '').trim().toLowerCase();
  const adminPassword = String(body?.adminPassword ?? '');
  const riteName = String(body?.riteName ?? '').trim() || undefined;
  const inviteCode = String(body?.invite ?? '').trim();

  if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 });
  }
  // Mesma validação da tela (senha de 8+, endereço sem espaços/maiúsculas, e-mail válido): o servidor não confia no navegador.
  const invalid = Object.values(validateLodgeSignup({ name, slug, adminName, adminEmail, adminPassword }))[0];
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // Cadastro de teste SOMENTE por convite.
  if (!inviteCode) {
    return NextResponse.json({ error: INVITE_ERROR_MESSAGES.missing }, { status: 403 });
  }
  const check = await validateInvite(inviteCode);
  if (!check.ok) {
    return NextResponse.json({ error: INVITE_ERROR_MESSAGES[check.reason] }, { status: 403 });
  }
  // Convite direcionado a um e-mail específico deve bater com o admin.
  if (check.invite.email && check.invite.email !== adminEmail) {
    return NextResponse.json(
      { error: 'Este convite é destinado a outro e-mail.' },
      { status: 403 },
    );
  }

  const existingUser = await prismaAdmin.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 });
  }

  const existingLodge = await prismaAdmin.lodge.findUnique({ where: { slug } });
  if (existingLodge) {
    return NextResponse.json({ error: 'Este slug já está em uso.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  // Convite pode conceder plano/duração de trial diferentes do padrão
  // (ex.: convite especial de 60 dias no plano Loja).
  const trialPlan = isPlanId(check.invite.plan) ? check.invite.plan : TRIAL_PLAN;
  const trialDaysForInvite = check.invite.trialDays ?? TRIAL_DAYS;
  const trialEndsAt = new Date(Date.now() + trialDaysForInvite * 24 * 60 * 60 * 1000);

  const result = await prismaAdmin.$transaction(async (tx) => {
    const lodge = await tx.lodge.create({
      data: {
        name,
        slug,
        status: 'active',
        acquisitionSource,
        riteName: riteName ?? null,
      },
    });

    const user = await tx.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: 'admin',
        lodgeId: lodge.id,
      },
    });

    // Trial no plano e duração do convite (ou padrão). Ao fim, deve assinar um dos planos.
    await tx.subscription.create({
      data: {
        lodgeId: lodge.id,
        plan: trialPlan,
        status: 'trialing',
        billingInterval: 'month',
        trialEndsAt,
      },
    });

    // Semeia ritos, potências, cargos do rito escolhido e plano de contas.
    await seedLodgeDefaults(tx, lodge.id, riteName);

    // Consome o convite DENTRO da transação e de forma atômica (só passa quem o encontra ainda pendente):
    // dois cadastros simultâneos com o mesmo código não criam duas lojas.
    const consumed = await tx.invitation.updateMany({
      where: { code: inviteCode.trim().toUpperCase(), status: 'pending', expiresAt: { gt: new Date() } },
      data: { status: 'used', usedAt: new Date(), lodgeId: lodge.id },
    });
    if (consumed.count !== 1) throw new InviteTakenError();

    return { lodge, user };
  }).catch((error) => (error instanceof InviteTakenError ? null : Promise.reject(error)));

  if (!result) return NextResponse.json({ error: INVITE_ERROR_MESSAGES.used }, { status: 409 });

  return NextResponse.json({
    lodge: result.lodge,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
    },
  });
}
