import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { dispatch, sleep, DISPATCH_THROTTLE_MS, type Channel } from '@/lib/messaging';
import { brl } from '@/lib/currency';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };
const VALID: Channel[] = ['email', 'whatsapp', 'sms'];

// Convoca os irmãos para a campanha pelos canais escolhidos. Cada envio gera um
// MessageLog (status sent/queued/failed). Sem provider configurado, fica
// "queued" (registrado) — ativa o envio real quando as credenciais existirem.
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'campaigns', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const channels: Channel[] = Array.isArray(body?.channels) ? body.channels.filter((c: string) => VALID.includes(c as Channel)) : [];
  const scope = body?.scope === 'all' ? 'all' : 'active';
  const custom = String(body?.message ?? '').trim();
  if (channels.length === 0) return NextResponse.json({ error: 'Selecione ao menos um canal.' }, { status: 400 });

  const stats = { sent: 0, queued: 0, failed: 0, skipped: 0 };

  // Etapa 1 (transação curta): só leitura. O laço de despacho roda FORA de
  // qualquer transação — uma transação interativa do Prisma expira em 5s por
  // padrão, e dezenas de membros × pausa de DISPATCH_THROTTLE_MS entre cada
  // envio passa fácil de 5s, derrubando a convocação inteira com "query
  // cannot be executed on an expired transaction" (visto em produção).
  const setup = await withTenant(String(lodgeId), async (db) => {
    const campaign = await db.campaign.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, title: true, description: true, beneficiaryName: true, goalAmount: true } });
    if (!campaign) return null;
    const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: LODGE_MESSAGING_SELECT });
    const members = await db.member.findMany({
      where: { lodgeId: String(lodgeId), ...(scope === 'active' ? { status: 'active' } : {}) },
      select: { id: true, name: true, email: true, phone: true },
    });
    return { campaign, lodge, members };
  });
  if (!setup) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });

  const { campaign, lodge, members } = setup;
  const lodgeChannels = buildLodgeChannels(lodge);
  const subject = `Campanha de benemerência: ${campaign.title}`;
  const meta = campaign.goalAmount ? ` Meta: ${brl(campaign.goalAmount)}.` : '';
  const text = custom || `Meus irmãos, a Hospitalaria abriu a campanha "${campaign.title}"${campaign.beneficiaryName ? ` em favor de ${campaign.beneficiaryName}` : ''}.${campaign.description ? ` ${campaign.description}` : ''}${meta} Contamos com a participação de todos. Fraternalmente.`;

  // Etapa 2: laço de despacho, sem transação aberta. Cada MessageLog é
  // gravado na sua própria transação curta (RLS continua garantido).
  let dispatched = 0;
  for (const m of members) {
    for (const channel of channels) {
      const to = channel === 'email' ? (m.email ?? '') : (m.phone ?? '');
      if (!to) { stats.skipped++; continue; }
      if (dispatched > 0) await sleep(DISPATCH_THROTTLE_MS);
      dispatched++;
      const r = await dispatch(channel, to, subject, text, lodgeChannels);
      stats[r.status]++;
      await withTenant(String(lodgeId), (db) =>
        db.messageLog.create({
          data: { lodgeId: String(lodgeId), memberId: m.id, channel, title: subject, content: text, status: r.status, error: r.detail ?? null },
        }),
      );
    }
  }

  // Etapa 3 (transação curta): auditoria.
  await withTenant(String(lodgeId), (db) =>
    logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'campaign-convocacao', entityId: id, metadata: { channels, scope, ...stats } }),
  );

  return NextResponse.json({ ok: true, stats });
}
