import { auth } from '@/lib/auth';
import { PLAN_INCLUDE, presentPlan } from '@/lib/degree-fee-server';
import { isCandidateRole } from '@/lib/candidate';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NOT_INTERNAL_DOCUMENT } from '@/lib/documents';
import { normalizeCollectionMode } from '@/lib/collection';
import { canPay, effectiveStatus, openBalance, PAYMENT_NOTICE_ENTITY, PAYMENT_NOTICE_REJECT_ENTITY, portalSummary, withoutRejected } from '@/lib/portal-dues';
import { canSeePaymentHistory } from '@/lib/payment-history';
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
    // canLookupCpf: o Administrador (sem cadastro ligado) consulta os lançamentos no próprio CPF.
    return NextResponse.json({ member: null, lodge: null, accounts: [], documents: [], institutionalDocuments: [], summary: { totalReceivables: 0, totalPayables: 0, overdue: 0 }, canLookupCpf: canSeePaymentHistory(role) });
  }

  // Candidato (profano em admissão): o portal mostra só débitos e cadastro —
  // nem os documentos da loja, nem a pasta dele (sigilosa).
  const candidate = isCandidateRole(role);
  const noDocuments = async () => [] as { id: string; title: string; kind: string; category?: string | null; createdAt: Date }[];

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
          id: true, title: true, type: true, amount: true, dueDate: true, status: true, memberId: true, approvalStatus: true, degreeFeePlan: { select: { paymentMethod: true } },
          chartAccount: { select: { name: true, category: true } },
          payments: { select: { id: true, amount: true, paidAt: true, method: true }, orderBy: { paidAt: 'asc' } },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ),
    candidate ? noDocuments() : withTenant(String(lodgeId), (db) =>
      db.document.findMany({
        where: { lodgeId: String(lodgeId), memberId: String(memberId), ...NOT_INTERNAL_DOCUMENT },
        select: { id: true, title: true, kind: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ),
    candidate ? noDocuments() : withTenant(String(lodgeId), (db) =>
      db.document.findMany({
        where: { lodgeId: String(lodgeId), memberId: null, ...NOT_INTERNAL_DOCUMENT },
        select: { id: true, title: true, kind: true, category: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ),
  ]);

  // Último "Já paguei" de cada conta em aberto (Modo Loja) — a tela mostra "Aviso enviado em …".
  const openIds = accounts.filter((a) => a.status !== 'paid').map((a) => a.id);
  // Aviso recusado pela Tesouraria (comprovante errado) não vale: a conta volta a "em aberto" e o
  // irmão vê o motivo da recusa mais recente, até avisar de novo.
  const { notices, rejections } = openIds.length
    ? await withTenant(String(lodgeId), async (db) => ({
        notices: await db.auditLog.findMany({
          where: { lodgeId: String(lodgeId), entity: PAYMENT_NOTICE_ENTITY, entityId: { in: openIds } },
          select: { entityId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
        rejections: await db.auditLog.findMany({
          where: { lodgeId: String(lodgeId), entity: PAYMENT_NOTICE_REJECT_ENTITY, entityId: { in: openIds } },
          select: { entityId: true, createdAt: true, after: true },
          orderBy: { createdAt: 'desc' },
        }),
      }))
    : { notices: [], rejections: [] };
  const lastNotice = new Map<string, Date>();
  for (const n of withoutRejected(notices, rejections)) if (!lastNotice.has(n.entityId)) lastNotice.set(n.entityId, n.createdAt);
  const lastRejection = new Map<string, { at: Date; reason: string | null }>();
  for (const r of rejections) {
    if (lastRejection.has(r.entityId)) continue;
    let reason: string | null = null;
    try { reason = (JSON.parse(r.after ?? '{}') as { reason?: string }).reason ?? null; } catch { reason = null; }
    lastRejection.set(r.entityId, { at: r.createdAt, reason });
  }

  const now = new Date();
  const items = accounts.map(({ memberId: owner, approvalStatus, ...a }) => {
    const balance = openBalance(a, a.payments);
    return {
      ...a,
      effectiveStatus: effectiveStatus(a, now),
      balance,
      payable: canPay({ ...a, memberId: owner, approvalStatus }, String(memberId), balance),
      paidNoticeAt: lastNotice.get(a.id) ?? null,
      // Só enquanto não houver aviso novo: depois dele, a recusa antiga é história.
      paidNoticeRejected: !lastNotice.has(a.id) && lastRejection.has(a.id) ? lastRejection.get(a.id)! : null,
    };
  });

  const summary = portalSummary(items);

  // Planos de taxa de grau do irmão (iniciação/elevação/exaltação): andamento e,
  // quitado antes do evento, o "crédito" reservado à cerimônia.
  const degreeFeePlans = (await withTenant(String(lodgeId), (db) =>
    db.degreeFeePlan.findMany({ where: { lodgeId: String(lodgeId), memberId: String(memberId), status: 'active' }, include: PLAN_INCLUDE, orderBy: { createdAt: 'desc' } }),
  )).map((p) => {
    const v = presentPlan(p, now);
    return { id: v.id, label: v.label, event: v.event, totalAmount: v.totalAmount, installments: v.installments, expectedEventDate: v.expectedEventDate, paid: v.summary.paid, open: v.summary.open, situation: v.summary.situation, cardUrl: v.summary.open > 0 ? v.cardUrl : null };
  });

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
    degreeFeePlans,
    isCandidate: candidate,
  });
}
