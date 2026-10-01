import { auth } from '@/lib/auth';
import { BULK_REMINDER_LOG_TITLE, normalizeReminderScope, startOfTodayBR } from '@/lib/charge-reminder';
import { loadReminderContext, sendReminder } from '@/lib/charge-reminder-server';
import { DISPATCH_THROTTLE_MS, sleep } from '@/lib/messaging';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Lembrete de cobranças em aberto por e-mail, para todos os irmãos de uma vez: UM e-mail por
// irmão com todas as cobranças dele, cada uma com o próprio meio de pagamento.
//  { action: 'preview', scope }            → quem recebe, quantas cobranças, total, sem e-mail,
//                                             quem já recebeu hoje (nada é enviado).
//  { action: 'send', scope, memberIds }    → envia só para os irmãos marcados na conferência.
// Trava: um lembrete em lote por irmão por dia (MessageLog), conferida de novo antes de cada envio.

export const maxDuration = 300;

const MAX_SEND = 500;

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const scope = normalizeReminderScope(body?.scope);
  const ctx = await loadReminderContext(lodgeId, { scope });
  if (!ctx) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });

  const since = startOfTodayBR();
  const sentTodayIds = async () => new Set(
    (await withTenant(lodgeId, (db) => db.messageLog.findMany({
      where: { lodgeId, channel: 'email', title: BULK_REMINDER_LOG_TITLE, status: 'sent', createdAt: { gte: since } },
      select: { memberId: true },
    }))).map((l) => l.memberId).filter((id): id is string => !!id),
  );

  if (body?.action !== 'send') {
    const sentToday = await sentTodayIds();
    return NextResponse.json({
      scope,
      emailReady: ctx.emailReady,
      asaasMode: ctx.asaasMode,
      // Modo Loja sem chave Pix: as cobranças saem sem código, só com os dados bancários.
      hasPayMethod: ctx.asaasMode || !!ctx.portalUrl || !!ctx.instructions,
      members: ctx.groups.map((g) => ({
        memberId: g.member.id,
        name: g.member.name,
        email: g.member.email,
        total: g.total,
        sentToday: sentToday.has(g.member.id),
        items: g.items.map((i) => ({ number: i.number, title: i.title, dueDate: new Date(i.dueDate).toISOString(), status: i.status, payAmount: i.payAmount, payable: !!(i.pixCopyPaste || i.payUrl) })),
      })),
    });
  }

  if (!ctx.emailReady) return NextResponse.json({ error: 'O envio de e-mail não está configurado na plataforma.' }, { status: 503 });
  const ids = Array.isArray(body?.memberIds) ? new Set((body.memberIds as unknown[]).map(String)) : new Set<string>();
  if (ids.size === 0) return NextResponse.json({ error: 'Marque pelo menos um irmão para enviar.' }, { status: 400 });
  if (ids.size > MAX_SEND) return NextResponse.json({ error: `No máximo ${MAX_SEND} irmãos por envio.` }, { status: 400 });

  const stats = { sent: 0, failed: 0, skipped: 0, failures: [] as { name: string; detail: string }[] };
  let dispatched = 0;
  for (const group of ctx.groups) {
    if (!ids.has(group.member.id)) continue;
    if (!group.member.email) { stats.skipped++; continue; }
    // Releitura por irmão: dois cliques (ou duas abas) não mandam o mesmo lembrete duas vezes.
    const dup = await withTenant(lodgeId, (db) => db.messageLog.findFirst({
      where: { lodgeId, memberId: group.member.id, channel: 'email', title: BULK_REMINDER_LOG_TITLE, status: 'sent', createdAt: { gte: since } },
      select: { id: true },
    }));
    if (dup) { stats.skipped++; continue; }
    if (dispatched > 0) await sleep(DISPATCH_THROTTLE_MS);
    dispatched++;
    const result = await sendReminder(lodgeId, ctx, group, BULK_REMINDER_LOG_TITLE);
    if (result.status === 'sent') stats.sent++;
    else {
      stats.failed++;
      stats.failures.push({ name: group.member.name, detail: result.detail ?? 'Falha no envio.' });
    }
  }
  return NextResponse.json(stats);
}
