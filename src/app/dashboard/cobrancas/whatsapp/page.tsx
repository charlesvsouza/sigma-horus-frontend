import { auth } from '@/lib/auth';
import { chargeUrgency, invoiceOpenBalance } from '@/lib/charge-notice';
import { isAsaasMode } from '@/lib/collection';
import { CLOSED_INVOICE_STATUSES } from '@/lib/portal-invoice';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { invoiceNumberFromLogTitle, normalizeWhatsAppPhone, WHATSAPP_LOG_TITLE_PREFIX, WHATSAPP_MANUAL_CHANNEL } from '@/lib/whatsapp-link';
import WhatsAppQueueClient, { type QueueRow } from './WhatsAppQueueClient';

// Fila de envio pelo WhatsApp (Modo Loja): todas as cobranças em aberto com saldo, e quando
// cada uma foi enviada (confirmada pelo Tesoureiro) ou só aberta no WhatsApp. O Tesoureiro passa
// irmão por irmão — o envio em si é dele, pelo wa.me (sem API, sem custo).
export default async function WhatsAppQueuePage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const denied = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return denied('Sessão expirada.');
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'write');
  if (!access.ok) return denied('Acesso restrito à Tesouraria.');

  const data = await withTenant(lodgeId, async (db) => {
    const [lodge, invoices, logs] = await Promise.all([
      db.lodge.findUnique({ where: { id: lodgeId }, select: { collectionMode: true, pixKey: true } }),
      db.invoice.findMany({
        where: { lodgeId, memberId: { not: null }, status: { notIn: CLOSED_INVOICE_STATUSES } },
        select: {
          id: true, number: true, amount: true, dueDate: true, status: true, description: true,
          member: { select: { name: true, phone: true } },
          account: { select: { title: true, amount: true, status: true, payments: { select: { amount: true } } } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      db.messageLog.findMany({
        where: { lodgeId, channel: WHATSAPP_MANUAL_CHANNEL, title: { startsWith: WHATSAPP_LOG_TITLE_PREFIX } },
        select: { title: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { lodge, invoices, logs };
  });

  if (isAsaasMode(data.lodge)) {
    return denied('O envio pelo WhatsApp é do Modo Loja. No Modo Asaas, o link da cobrança emitida e as notificações do próprio Asaas cumprem esse papel.');
  }

  // Por número de cobrança (logs do mais recente para o mais antigo): último envio confirmado e
  // abertura sem confirmação mais recente que ele.
  const lastSent = new Map<string, string>();
  const lastOpened = new Map<string, string>();
  for (const log of data.logs) {
    const number = invoiceNumberFromLogTitle(log.title);
    if (!number) continue;
    if (log.status === 'sent') {
      if (!lastSent.has(number)) lastSent.set(number, log.createdAt.toISOString());
    } else if (log.status === 'handed-off' && !lastSent.has(number) && !lastOpened.has(number)) {
      lastOpened.set(number, log.createdAt.toISOString());
    }
  }

  const rows: QueueRow[] = data.invoices
    .map((i) => ({
      id: i.id,
      number: i.number,
      title: i.account?.title ?? i.description ?? '',
      memberName: i.member?.name ?? '—',
      hasPhone: !!normalizeWhatsAppPhone(i.member?.phone),
      balance: invoiceOpenBalance(i.amount, i.account),
      dueDate: i.dueDate.toISOString(),
      urgency: chargeUrgency(i.dueDate, i.status),
      lastSentAt: lastSent.get(i.number) ?? null,
      lastOpenedAt: lastOpened.get(i.number) ?? null,
    }))
    .filter((r) => r.balance > 0);

  return <WhatsAppQueueClient rows={rows} hasPixKey={!!data.lodge?.pixKey?.trim()} />;
}
