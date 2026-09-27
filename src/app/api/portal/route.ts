import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NOT_INTERNAL_DOCUMENT } from '@/lib/documents';
import { normalizeCollectionMode } from '@/lib/collection';
import { canPay, effectiveStatus, openBalance, PAYMENT_NOTICE_ENTITY, portalSummary } from '@/lib/portal-dues';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const memberId = session?.user?.memberId;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'portal', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Sem vínculo User→Member (ex.: admin criado sem cadastro de membro), não há
  // "meu portal" a mostrar — evita expor o primeiro membro da loja por engano.
  if (!memberId) {
    return NextResponse.json({ member: null, lodge: null, accounts: [], documents: [], institutionalDocuments: [], summary: { totalReceivables: 0, totalPayables: 0, overdue: 0 } });
  }

  const [member, lodge, accounts, documents, institutionalDocuments] = await Promise.all([
    withTenant(String(lodgeId), (db) =>
      db.member.findFirst({
        where: { id: String(memberId), lodgeId: String(lodgeId) },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          currentDegree: true,
          originLodge: true,
          initiationDate: true,
          elevationDate: true,
          exaltationDate: true,
          installationDate: true,
          gradeName: true,
          photoUrl: true,
          addressLine: true,
          addressNumber: true,
          complement: true,
          neighborhood: true,
          city: true,
          state: true,
          zipCode: true,
          country: true,
          relatives: { orderBy: { order: 'asc' } },
        },
      }),
    ),
    withTenant(String(lodgeId), (db) =>
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true, collectionMode: true, pixKey: true } }),
    ),
    withTenant(String(lodgeId), (db) =>
      db.account.findMany({
        where: { lodgeId: String(lodgeId), memberId: String(memberId) },
        select: {
          id: true, title: true, type: true, amount: true, dueDate: true, status: true, memberId: true, approvalStatus: true,
          chartAccount: { select: { name: true, category: true } },
          payments: { select: { id: true, amount: true, paidAt: true, method: true }, orderBy: { paidAt: 'asc' } },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ),
    withTenant(String(lodgeId), (db) =>
      db.document.findMany({
        where: { lodgeId: String(lodgeId), memberId: String(memberId), ...NOT_INTERNAL_DOCUMENT },
        select: { id: true, title: true, kind: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ),
    withTenant(String(lodgeId), (db) =>
      db.document.findMany({
        where: { lodgeId: String(lodgeId), memberId: null, ...NOT_INTERNAL_DOCUMENT },
        select: { id: true, title: true, kind: true, category: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ),
  ]);

  // Último "Já paguei" de cada conta em aberto (Modo Loja) — a tela mostra "Aviso enviado em …".
  const openIds = accounts.filter((a) => a.status !== 'paid').map((a) => a.id);
  const notices = openIds.length
    ? await withTenant(String(lodgeId), (db) =>
        db.auditLog.findMany({
          where: { lodgeId: String(lodgeId), entity: PAYMENT_NOTICE_ENTITY, entityId: { in: openIds } },
          select: { entityId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
      )
    : [];
  const lastNotice = new Map<string, Date>();
  for (const n of notices) if (!lastNotice.has(n.entityId)) lastNotice.set(n.entityId, n.createdAt);

  const now = new Date();
  const items = accounts.map(({ memberId: owner, approvalStatus, ...a }) => {
    const balance = openBalance(a, a.payments);
    return {
      ...a,
      effectiveStatus: effectiveStatus(a, now),
      balance,
      payable: canPay({ ...a, memberId: owner, approvalStatus }, String(memberId), balance),
      paidNoticeAt: lastNotice.get(a.id) ?? null,
    };
  });

  const summary = portalSummary(items);

  const collection = lodge
    ? { mode: normalizeCollectionMode(lodge.collectionMode), hasPixKey: Boolean(lodge.pixKey?.trim()) }
    : null;

  return NextResponse.json({
    member,
    lodge: lodge ? { name: lodge.name, crestUrl: lodge.crestUrl } : null,
    collection,
    accounts: items,
    documents,
    institutionalDocuments,
    summary,
  });
}
