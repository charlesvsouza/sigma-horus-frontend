import { auth } from '@/lib/auth';
import { autoEmitAllLodges, autoEmitForLodge } from '@/lib/asaas-auto-emit';
import { cronAuthorized } from '@/lib/platform-auth';
import { prismaAdmin } from '@/lib/prisma';
import { processRecurringAllLodges, processRecurringForLodge } from '@/lib/recurring';
import { notifyEndingRecurrences } from '@/lib/recurring-renewal';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Cobranças recorrentes. Duas portas de entrada:
//  - GET (Vercel Cron, Authorization: Bearer $CRON_SECRET): todas as lojas ativas, uma vez por dia.
//  - POST (botão "Processar recorrentes" em Cobranças): só a loja de quem clicou.
// Regras (lib/recurring.ts): cada ocorrência nasce até RECURRING_LEAD_DAYS (10) dias antes do vencimento;
// no máximo UMA ocorrência por cobrança-mãe por rodada; a recorrência
// independe de a cobrança anterior estar paga; irmão bloqueado (comunicado à Potência) fica retido
// até voltar (lib/member-block-server → liftBlock). O Art. 002 em si não retém nada.
// Depois da geração, a emissão automática no Asaas (lib/asaas-auto-emit.ts) — só nas lojas que
// ligaram a opção — para os lembretes das 11:00 UTC já saírem com o Pix.

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const recurring = await processRecurringAllLodges();
  const autoEmit = await autoEmitAllLodges();
  // Aviso (uma vez) de que o período programado das recorrências está acabando: renovar ou criar outro.
  const endNotice = await notifyEndingRecurrences().catch((err) => {
    console.error('recorrência: falha no aviso de fim de período', err);
    return null;
  });
  return NextResponse.json({ ...recurring, autoEmit, endNotice });
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

  const recurring = await processRecurringForLodge(lodgeId, String(session.user.id));
  const lodge = await prismaAdmin.lodge.findUnique({
    where: { id: lodgeId },
    select: { collectionMode: true, asaasAutoEmit: true, asaasApiKeyEnc: true, asaasSettlementAccountId: true },
  });
  const autoEmit = lodge?.collectionMode === 'asaas' && lodge.asaasAutoEmit && lodge.asaasApiKeyEnc && lodge.asaasSettlementAccountId
    ? await autoEmitForLodge(lodgeId)
    : null;
  return NextResponse.json({ ...recurring, autoEmit });
}
