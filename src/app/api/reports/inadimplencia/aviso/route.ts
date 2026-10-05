import { auth } from '@/lib/auth';
import { DISPATCH_THROTTLE_MS, sleep } from '@/lib/messaging';
import { loadOverdueNotices, sendOverdueNoticeEmail } from '@/lib/overdue-notice-server';
import { overdueNoticeRef, overdueNoticeText, overdueNoticeWindowStart } from '@/lib/overdue-notice';
import { ART_002_THRESHOLD_DAYS } from '@/lib/overdue-rules';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Aviso de inadimplência por e-mail (relatório Inadimplência — Art. 002), para todos os irmãos da lista de uma vez.
//  { action: 'preview', memberIds }            → quem recebe, quem fica de fora (sem e-mail / recebeu aviso em 7 dias)
//                                                 e um exemplo do texto. Nada é enviado.
//  { action: 'send', memberIds, sendIds }      → envia só para os marcados. Os números são recalculados aqui
//                                                 (nunca vêm da tela).
// Trava: um aviso por irmão a cada 7 dias (MessageLog, qualquer canal), conferida de novo antes de cada envio.

export const maxDuration = 300;
const MAX_SEND = 500;

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const memberIds = Array.isArray(body?.memberIds) ? [...new Set((body.memberIds as unknown[]).map(String))] : [];
  if (memberIds.length === 0) return NextResponse.json({ error: 'Nenhum irmão na lista.' }, { status: 400 });
  if (memberIds.length > 1000) return NextResponse.json({ error: 'Lista grande demais: filtre o relatório.' }, { status: 400 });

  const ctx = await loadOverdueNotices(lodgeId, memberIds);
  if (!ctx) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });

  if (body?.action !== 'send') {
    return NextResponse.json({
      emailReady: ctx.emailReady,
      leftOut: ctx.leftOut,
      sample: ctx.members[0] ? overdueNoticeText(ctx.members[0].input) : null,
      members: ctx.members.map((m) => ({
        memberId: m.memberId, name: m.name, email: m.email, hasPhone: Boolean(m.phone),
        count: m.input.count, total: m.input.total, daysOverdue: m.input.daysOverdue,
        art002: m.input.art002Enabled && m.input.daysOverdue > ART_002_THRESHOLD_DAYS,
        sentRecently: m.sentRecently, lastSentAt: m.lastSentAt,
      })),
    });
  }

  if (!ctx.emailReady) return NextResponse.json({ error: 'O envio de e-mail não está configurado na plataforma.' }, { status: 503 });
  const ids = Array.isArray(body?.sendIds) ? new Set((body.sendIds as unknown[]).map(String)) : new Set<string>();
  if (ids.size === 0) return NextResponse.json({ error: 'Marque pelo menos um irmão para enviar.' }, { status: 400 });
  if (ids.size > MAX_SEND) return NextResponse.json({ error: `No máximo ${MAX_SEND} irmãos por envio.` }, { status: 400 });

  const stats = { sent: 0, failed: 0, skipped: 0, failures: [] as { name: string; detail: string }[] };
  let dispatched = 0;
  for (const m of ctx.members) {
    if (!ids.has(m.memberId)) continue;
    if (!m.email) { stats.skipped++; continue; }
    // Releitura por irmão: dois cliques (ou duas abas) não mandam o aviso duas vezes.
    const dup = await withTenant(lodgeId, (db) => db.messageLog.findFirst({
      where: { lodgeId, memberId: m.memberId, ref: overdueNoticeRef(m.memberId), status: 'sent', createdAt: { gte: overdueNoticeWindowStart() } },
      select: { id: true },
    }));
    if (dup) { stats.skipped++; continue; }
    if (dispatched > 0) await sleep(DISPATCH_THROTTLE_MS);
    dispatched++;
    const result = await sendOverdueNoticeEmail(lodgeId, ctx, m);
    if (result.status === 'sent') stats.sent++;
    else { stats.failed++; stats.failures.push({ name: m.name, detail: result.detail ?? 'Falha no envio.' }); }
  }
  return NextResponse.json(stats);
}
