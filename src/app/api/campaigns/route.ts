import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { getTroncoBalance } from '@/lib/hospitalaria';
import { configuredChannels } from '@/lib/messaging';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

const str = (v: unknown) => { const s = v == null ? '' : String(v).trim(); return s || null; };
const BENEFICIARY = ['person', 'company', 'institution'];
const FUNDING = ['fund', 'donations', 'mixed'];

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ items: [], tronco: null });

  const access = await requireLodgeAccess(String(lodgeId), role, 'campaigns', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const data = await withTenant(String(lodgeId), async (db) => {
    const [campaigns, tronco] = await Promise.all([
      db.campaign.findMany({
        where: { lodgeId: String(lodgeId) },
        include: { donations: { select: { amount: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      getTroncoBalance(db, String(lodgeId)),
    ]);
    const items = campaigns.map((c) => {
      const raised = c.donations.reduce((s, d) => s + Number(d.amount), 0);
      return { ...c, donations: undefined, raised, totalApplied: raised + Number(c.fundAllocated) };
    });
    return { items, tronco };
  });

  return NextResponse.json({ ...data, channels: configuredChannels() });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'campaigns', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const title = String(body?.title ?? '').trim();
  const beneficiaryType = BENEFICIARY.includes(body?.beneficiaryType) ? body.beneficiaryType : 'person';
  const fundingSource = FUNDING.includes(body?.fundingSource) ? body.fundingSource : 'donations';
  const goalAmount = body?.goalAmount != null && body.goalAmount !== '' ? Number(body.goalAmount) : null;
  if (!title) return NextResponse.json({ error: 'Informe o título da campanha.' }, { status: 400 });

  const item = await withTenant(String(lodgeId), async (db) => {
    const created = await db.campaign.create({
      data: {
        lodgeId: String(lodgeId),
        title,
        description: str(body?.description),
        beneficiaryType,
        beneficiaryName: str(body?.beneficiaryName),
        goalAmount: goalAmount != null && !Number.isNaN(goalAmount) ? goalAmount : null,
        fundingSource,
        createdById: session.user.id,
      },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'campaign', entityId: created.id, metadata: { title } });
    return created;
  });

  return NextResponse.json({ item });
}
