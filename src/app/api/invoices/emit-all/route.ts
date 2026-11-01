import { auth } from '@/lib/auth';
import { emitInvoiceCharge } from '@/lib/asaas-charge';
import { loadBatchEmit } from '@/lib/asaas-batch-emit-server';
import { MAX_BATCH_PER_CALL } from '@/lib/asaas-batch-emit';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Emissão em lote no Asaas (Cobranças → "Emitir em lote no Asaas"). Nada é cancelado nem recriado:
// cada cobrança em aberto ainda não emitida ganha a sua cobrança no Asaas (Pix ou boleto, padrão da loja).
//  { action: 'preview' }          → o que seria emitido e o que fica de fora (nada é emitido).
//  { action: 'send', invoiceIds } → emite as cobranças marcadas (até MAX_BATCH_PER_CALL por chamada; a tela
//                                   repete a chamada em partes). Cada uma é conferida de novo antes de emitir.

export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const load = await loadBatchEmit(lodgeId);
  if (!load.ready) return NextResponse.json({ error: load.error }, { status: load.status });

  if (body?.action !== 'send') {
    return NextResponse.json({ billingType: load.billingType, items: load.items });
  }

  const ids = Array.isArray(body?.invoiceIds) ? [...new Set((body.invoiceIds as unknown[]).map(String))] : [];
  if (ids.length === 0) return NextResponse.json({ error: 'Marque pelo menos uma cobrança para emitir.' }, { status: 400 });
  if (ids.length > MAX_BATCH_PER_CALL) return NextResponse.json({ error: `No máximo ${MAX_BATCH_PER_CALL} cobranças por chamada.` }, { status: 400 });

  const byId = new Map(load.items.map((i) => [i.invoiceId, i]));
  const stats = { emitted: 0, failed: 0, skipped: 0, failures: [] as { number: string; name: string; detail: string }[] };
  // Uma por vez: cada emissão faz rede (Asaas) fora de transação, como o clique da Tesouraria.
  for (const id of ids) {
    const item = byId.get(id);
    // Já emitida por outra aba, paga, em acordo, sem CPF…: a conferência do servidor manda, não a da tela.
    if (!item || item.value === null) { stats.skipped++; continue; }
    const r = await emitInvoiceCharge({ lodgeId, invoiceId: id, actorId: session.user.id, value: item.value });
    if (r.ok) stats.emitted++;
    else {
      stats.failed++;
      stats.failures.push({ number: item.number, name: item.memberName, detail: r.error });
    }
  }
  return NextResponse.json(stats);
}
