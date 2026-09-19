import { auth } from '@/lib/auth';
import { cronAuthorized } from '@/lib/platform-auth';
import { processRecurringAllLodges, processRecurringForLodge } from '@/lib/recurring';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Cobranças recorrentes. Duas portas de entrada:
//  - GET (Vercel Cron, Authorization: Bearer $CRON_SECRET): todas as lojas ativas, uma vez por dia.
//  - POST (botão "Processar recorrentes" em Cobranças): só a loja de quem clicou.
// Regras (lib/recurring.ts): no máximo UMA ocorrência por cobrança-mãe por rodada; a recorrência
// independe de a cobrança anterior estar paga; membro no Art. 002 fica retido até o Tesoureiro ou
// o Venerável liberar (POST /api/members/[id]/release-recurring).

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await processRecurringAllLodges());
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const lodgeId = String(session.user.lodgeId);
  // Gera cobranças em nome da loja: exige escrita em Contas (Tesoureiro/Administrador).
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  return NextResponse.json(await processRecurringForLodge(lodgeId, String(session.user.id)));
}
