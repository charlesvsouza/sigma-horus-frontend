import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { withTenant } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { commitPlan, findLegacyBatches } from '@/lib/legacy-import/commit';
import { parseOptions, planFor, readUploads, resolveActor } from '../shared';
import { requireActiveSubscription } from '@/lib/subscription-guard';

export const maxDuration = 60;

// Passo 2: refaz o plano com os mesmos arquivos/opções (nada é confiado do navegador) e grava.
// Recusa quando alguma conferência de totais falhou (a menos que o usuário aceite explicitamente)
// e quando a loja já tem um lote importado (evita duplicar o histórico inteiro).
export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Envie os arquivos como formulário (multipart).' }, { status: 400 });

  const actor = await resolveActor(request, formData.get('lodgeId') ? String(formData.get('lodgeId')) : null);
  if ('error' in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });
  const subscription = await requireActiveSubscription(actor.lodgeId);
  if (!subscription.ok) return NextResponse.json({ error: subscription.error, code: subscription.code }, { status: subscription.status });

  const options = parseOptions(formData.get('options'));
  if ('error' in options) return NextResponse.json({ error: options.error }, { status: 400 });

  const read = await readUploads(formData);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });

  const { plan } = await planFor(actor.lodgeId, read.files, options);
  const failed = plan.checks.filter((c) => !c.ok);
  if (failed.length > 0 && formData.get('acceptFailedChecks') !== 'true') {
    return NextResponse.json({ error: 'Há conferências de totais que não fecharam. Revise ou confirme que quer importar mesmo assim.', failed }, { status: 409 });
  }
  if (plan.summary.transactions + plan.summary.openItems + plan.counterparties.length === 0 && !plan.balancete) {
    return NextResponse.json({ error: 'Não há nada para importar nestes arquivos.' }, { status: 400 });
  }

  const batchId = randomBytes(4).toString('hex');
  try {
    const result = await withTenant(actor.lodgeId, async (db) => {
      const previous = await findLegacyBatches(db, actor.lodgeId);
      if (previous.length > 0 && formData.get('allowRepeat') !== 'true') return { blocked: previous, res: null };
      const res = await commitPlan(db, actor.lodgeId, plan, { batchId, createdById: actor.isPlatform ? null : actor.userId });
      await logAudit(db, {
        lodgeId: actor.lodgeId, userId: actor.userId, action: 'CREATE', entity: 'legacy_import', entityId: batchId,
        metadata: { files: read.reports.filter((r) => r.status === 'used').map((r) => r.name), ...res },
      });
      return { blocked: null, res };
    });
    if (result.blocked) {
      return NextResponse.json({ error: `Esta loja já tem uma importação anterior (lote ${result.blocked.join(', ')}). Desfaça-a antes ou confirme que quer importar de novo.`, previous: result.blocked }, { status: 409 });
    }
    return NextResponse.json({ ok: true, ...result.res });
  } catch (e) {
    console.error('legacy import commit failed', e);
    return NextResponse.json({ error: 'A importação falhou e nada foi gravado (a operação é atômica). Tente novamente ou fale com o suporte.' }, { status: 500 });
  }
}
