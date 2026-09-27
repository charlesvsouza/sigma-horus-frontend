import { auth } from '@/lib/auth';
import { isValidCPF, onlyDigits } from '@/lib/masks';
import { effectiveStatus, openBalance } from '@/lib/portal-dues';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// "Lançamentos no meu CPF": o Administrador não tem cadastro de membro ligado ao login
// (papéis não se confundem — decisão de 2026-09-20), mas quer ver o que está lançado no
// CPF dele sem trocar de login. Só leitura, sem Pagar (quem paga é o login de obreiro).
// Exige `accounts:read`: quem chega aqui já enxerga essas contas em Financeiro → Contas,
// então a busca por CPF não amplia acesso nenhum.

export async function GET(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const cpf = onlyDigits(new URL(request.url).searchParams.get('cpf') ?? '');
  if (!isValidCPF(cpf)) return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });

  const result = await withTenant(lodgeId, async (db) => {
    // O CPF é gravado como foi digitado (com ou sem máscara): compara só os dígitos.
    const candidates = await db.member.findMany({ where: { lodgeId, cpf: { not: null } }, select: { id: true, name: true, cpf: true } });
    const member = candidates.find((m) => onlyDigits(m.cpf ?? '') === cpf);
    if (!member) return null;
    const accounts = await db.account.findMany({
      where: { lodgeId, memberId: member.id },
      select: {
        id: true, title: true, type: true, amount: true, dueDate: true, status: true,
        chartAccount: { select: { name: true, category: true } },
        payments: { select: { id: true, amount: true, paidAt: true, method: true }, orderBy: { paidAt: 'asc' } },
      },
      orderBy: { dueDate: 'asc' },
    });
    return { member: { name: member.name }, accounts };
  });

  if (!result) return NextResponse.json({ error: 'Nenhum membro desta loja tem esse CPF no cadastro.' }, { status: 404 });

  const now = new Date();
  return NextResponse.json({
    member: result.member,
    accounts: result.accounts.map((a) => ({ ...a, effectiveStatus: effectiveStatus(a, now), balance: openBalance(a, a.payments) })),
  });
}
