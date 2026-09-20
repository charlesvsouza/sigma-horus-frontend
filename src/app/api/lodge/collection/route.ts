import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { COLLECTION_MODES, normalizeBillingChoice, type CollectionMode } from '@/lib/collection';
import { NextResponse } from 'next/server';
import { requireActiveSubscription } from '@/lib/subscription-guard';

// Modo de recebimento das cobranças — decisão da própria loja (só o Administrador altera).
export async function PUT(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const subscription = await requireActiveSubscription(String(lodgeId));
  if (!subscription.ok) return NextResponse.json({ error: subscription.error, code: subscription.code }, { status: subscription.status });
  if (normalizeRole(session?.user?.role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas o Administrador pode alterar o modo de recebimento.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const mode = String(body?.collectionMode ?? '') as CollectionMode;
  if (!COLLECTION_MODES.includes(mode)) {
    return NextResponse.json({ error: 'Modo de recebimento inválido.' }, { status: 400 });
  }
  const billing = normalizeBillingChoice(body?.asaasBillingType);
  const settlementId = body?.asaasSettlementAccountId ? String(body.asaasSettlementAccountId) : null;

  const result = await withTenant(String(lodgeId), async (db) => {
    const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { asaasApiKeyEnc: true, collectionMode: true } });
    if (!lodge) return { error: 'Loja não encontrada.', status: 404 } as const;

    // A conta de repasse é sempre uma conta corrente da própria loja (nunca caixa de fundo, investimento ou "conta Asaas").
    let settlement: string | null = null;
    if (settlementId) {
      const acc = await db.financialAccount.findFirst({
        where: { id: settlementId, lodgeId: String(lodgeId), active: true, kind: 'bank', isInvestment: false, purpose: 'general' },
        select: { id: true },
      });
      if (!acc) return { error: 'A conta de repasse deve ser uma conta corrente ativa da loja (não pode ser investimento nem caixa de fundo).', status: 400 } as const;
      settlement = acc.id;
    }

    if (mode === 'asaas') {
      if (!lodge.asaasApiKeyEnc) return { error: 'Conecte o Asaas em Integrações antes de escolher o Modo Asaas.', status: 409 } as const;
      if (!settlement) return { error: 'No Modo Asaas, escolha a conta corrente que recebe o repasse do Asaas.', status: 400 } as const;
    }

    await db.lodge.update({
      where: { id: String(lodgeId) },
      data: { collectionMode: mode, asaasBillingType: billing, ...(settlementId !== null || mode === 'lodge' ? { asaasSettlementAccountId: settlement } : {}) },
    });

    // Trocar para o Modo Loja não cancela cobranças já emitidas no Asaas: elas seguem valendo até serem pagas.
    const openAsaasCharges = mode === 'lodge' && lodge.collectionMode === 'asaas'
      ? await db.invoice.count({ where: { lodgeId: String(lodgeId), asaasPaymentId: { not: null }, status: { in: ['billed', 'overdue'] } } })
      : 0;

    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'lodge-collection',
      entityId: String(lodgeId),
      metadata: { collectionMode: mode, asaasBillingType: billing, asaasSettlementAccountId: settlement },
    });
    return { ok: true, openAsaasCharges } as const;
  });

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, openAsaasCharges: result.openAsaasCharges });
}
