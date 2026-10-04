import { auth } from '@/lib/auth';
import { loadMemberQuick } from '@/lib/member-quick-server';
import { quickAccess } from '@/lib/member-quick';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccessFor } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Painel rápido do irmão (navegação rápida). Só leitura; o que volta depende do cargo de quem pergunta:
// contato exige leitura de Membros e financeiro exige leitura de Contas — o painel nunca amplia permissão.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!session?.user || !lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const who = { lodgeId: String(lodgeId), role: session.user.role, memberId: session.user.memberId ?? null };
  const [canMembers, canAccounts] = await Promise.all([
    canLodgeAccessFor(who, 'members', 'read'),
    canLodgeAccessFor(who, 'accounts', 'read'),
  ]);
  const access = quickAccess(canMembers, canAccounts, session.user.role);
  if (!access) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const data = await withTenant(String(lodgeId), (db) => loadMemberQuick(db, String(lodgeId), id, access));
  if (!data) return NextResponse.json({ error: 'Irmão não encontrado.' }, { status: 404 });
  return NextResponse.json(data);
}
