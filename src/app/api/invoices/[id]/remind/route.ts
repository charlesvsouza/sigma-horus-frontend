import { auth } from '@/lib/auth';
import { singleReminderLogTitle } from '@/lib/charge-reminder';
import { loadReminderContext, sendReminder } from '@/lib/charge-reminder-server';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Lembrete manual de uma cobrança específica — complementa o lembrete
// automático do cron diário (só vencidas há mais de 30 dias), pra quando o
// tesoureiro quer cobrar na hora (ex.: cobrança já vencida). Mesmo e-mail do
// lembrete em lote (lib/charge-reminder), com uma cobrança só.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;

  const invoice = await withTenant(String(lodgeId), (db) =>
    db.invoice.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { number: true, status: true, member: { select: { email: true } } } }),
  );
  if (!invoice) return NextResponse.json({ error: 'Cobrança não encontrada.' }, { status: 404 });
  if (invoice.status === 'paid') return NextResponse.json({ error: 'Esta cobrança já está paga.' }, { status: 409 });
  if (!invoice.member) return NextResponse.json({ error: 'Vincule a cobrança a um membro para enviar o lembrete.' }, { status: 400 });
  if (!invoice.member.email) return NextResponse.json({ error: 'O membro desta cobrança não tem e-mail cadastrado.' }, { status: 400 });

  const ctx = await loadReminderContext(String(lodgeId), { scope: 'all', invoiceId: id });
  const group = ctx?.groups[0];
  if (!ctx || !group) return NextResponse.json({ error: 'Esta cobrança não tem saldo em aberto.' }, { status: 409 });

  const result = await sendReminder(String(lodgeId), ctx, group, singleReminderLogTitle(invoice.number));
  if (result.status === 'failed') {
    return NextResponse.json({ error: result.detail ?? 'Falha ao enviar o lembrete.' }, { status: 502 });
  }
  return NextResponse.json({ success: true, status: result.status });
}
