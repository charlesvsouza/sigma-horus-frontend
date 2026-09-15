import { auth } from '@/lib/auth';
import { getTroncoBalance } from '@/lib/hospitalaria';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { channelsAvailable } from '@/lib/messaging';
import { withTenant } from '@/lib/prisma';
import CampanhasClient from './CampanhasClient';

// Server Component: campanhas + saldo do Tronco + canais disponíveis.
export default async function CampanhasPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => {
        const [campaigns, tronco, lodge, requests] = await Promise.all([
          db.campaign.findMany({
            where: { lodgeId: String(lodgeId) },
            include: { donations: { select: { amount: true } } },
            orderBy: { createdAt: 'desc' },
          }),
          getTroncoBalance(db, String(lodgeId)),
          db.lodge.findUnique({ where: { id: String(lodgeId) }, select: LODGE_MESSAGING_SELECT }),
          db.hospitalityRequest.findMany({
            where: { lodgeId: String(lodgeId) },
            include: { member: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
          }),
        ]);
        const items = campaigns.map((c) => {
          const raised = c.donations.reduce((s, d) => s + Number(d.amount), 0);
          return {
            id: c.id,
            title: c.title,
            description: c.description ?? null,
            beneficiaryType: c.beneficiaryType,
            beneficiaryName: c.beneficiaryName ?? null,
            goalAmount: c.goalAmount != null ? Number(c.goalAmount) : null,
            fundingSource: c.fundingSource,
            fundAllocated: Number(c.fundAllocated),
            status: c.status,
            raised,
            totalApplied: raised + Number(c.fundAllocated),
          };
        });
        const requestItems = requests.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description ?? null,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          memberName: r.member.name,
        }));
        return { items, tronco, channels: channelsAvailable(buildLodgeChannels(lodge)), requests: requestItems };
      })
    : { items: [], tronco: null, channels: { email: false, whatsapp: false, sms: false }, requests: [] };

  return <CampanhasClient items={data.items} tronco={data.tronco} channels={data.channels} requests={data.requests} />;
}
