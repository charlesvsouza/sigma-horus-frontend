import {
  missingRecordFields, recordEmailRef, recordMemberEmail, recordSecretaryEmail, RECORD_EMAIL_REF_PREFIX,
  type RecordGap,
} from '@/lib/incomplete-record';
import { portalPayUrl } from '@/lib/collection';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { dispatch } from '@/lib/messaging';
import { prismaAdmin, withTenant } from '@/lib/prisma';

// Pedido por e-mail para completar o cadastro (CPF, e-mail, nascimento): um e-mail a cada irmão que tem
// e-mail (corrige ele mesmo no portal) e um resumo ao Secretário, que corrige quem não tem. O envio nunca
// fica dentro de transação. Cada e-mail ao irmão vai ao MessageLog (ref cadastro-email:<id>) e não se
// repete antes de `throttleDays` — o cron semanal não enche a caixa de ninguém.

export interface NoticeStats { incomplete: number; membersEmailed: number; membersSkipped: number; secretaryEmailed: number; reason?: string }

const DAY = 24 * 60 * 60 * 1000;

export async function sendIncompleteRecordNotices(
  lodgeId: string,
  opts: { members: boolean; secretary: boolean; throttleDays?: number; now?: Date },
): Promise<NoticeStats> {
  const now = opts.now ?? new Date();
  const stats: NoticeStats = { incomplete: 0, membersEmailed: 0, membersSkipped: 0, secretaryEmailed: 0 };
  const data = await withTenant(lodgeId, async (db) => {
    const since = opts.throttleDays ? new Date(now.getTime() - opts.throttleDays * DAY) : null;
    const [lodge, members, secretaries, recent] = await Promise.all([
      db.lodge.findUnique({ where: { id: lodgeId }, select: { ...LODGE_MESSAGING_SELECT, tradeName: true } }),
      db.member.findMany({ where: { lodgeId, status: 'active', deceased: false }, select: { id: true, name: true, email: true, cpf: true, birthDate: true }, orderBy: { name: 'asc' } }),
      db.user.findMany({ where: { lodgeId, role: 'secretary', status: 'active' }, select: { email: true } }),
      since
        ? db.messageLog.findMany({ where: { lodgeId, channel: 'email', status: 'sent', ref: { startsWith: RECORD_EMAIL_REF_PREFIX }, createdAt: { gte: since } }, select: { memberId: true } })
        : Promise.resolve([] as { memberId: string | null }[]),
    ]);
    return { lodge, members, secretaries, recent };
  });
  if (!data.lodge) return { ...stats, reason: 'Loja não encontrada.' };
  const lodgeName = data.lodge.tradeName || data.lodge.name || 'Loja';
  const channels = buildLodgeChannels(data.lodge);

  const gaps = data.members
    .map((m) => ({ id: m.id, name: m.name, email: m.email?.trim() || null, missing: missingRecordFields(m) }))
    .filter((g) => g.missing.length > 0);
  stats.incomplete = gaps.length;
  if (gaps.length === 0) return stats;

  const portalUrl = portalPayUrl();
  const pageUrl = portalUrl.replace(/\/portal$/, '/membros/cadastros-incompletos');
  const alreadyNoticed = new Set(data.recent.map((r) => r.memberId));

  async function log(memberId: string | null, title: string, content: string, ref: string | null, status: string, error: string | null) {
    await withTenant(lodgeId, (db) => db.messageLog.create({ data: { lodgeId, memberId, channel: 'email', title, content, status, error, ref } }));
  }

  if (opts.members) {
    for (const g of gaps) {
      if (!g.email || alreadyNoticed.has(g.id)) { stats.membersSkipped++; continue; }
      const mail = recordMemberEmail(g.name, lodgeName, g.missing, portalUrl);
      const r = await dispatch('email', g.email, mail.subject, mail.text, channels).catch((e) => ({ status: 'failed' as const, detail: String(e?.message ?? e) }));
      await log(g.id, 'E-mail: atualização cadastral', mail.text, recordEmailRef(g.id), r.status, r.detail ?? null);
      if (r.status === 'sent') stats.membersEmailed++;
    }
  }

  if (opts.secretary) {
    const list: RecordGap[] = gaps.map((g) => ({ name: g.name, missing: g.missing, hasEmail: Boolean(g.email) }));
    const mail = recordSecretaryEmail(lodgeName, list, pageUrl);
    for (const to of new Set(data.secretaries.map((u) => u.email).filter(Boolean))) {
      const r = await dispatch('email', to, mail.subject, mail.text, channels).catch(() => null);
      if (r?.status === 'sent') stats.secretaryEmailed++;
    }
    if (stats.secretaryEmailed > 0) await log(null, 'E-mail: cadastros incompletos (Secretaria)', mail.text, `${RECORD_EMAIL_REF_PREFIX}secretaria`, 'sent', null);
  }
  return stats;
}

/** Cron semanal (segunda): resumo ao Secretário e pedido ao irmão (no máximo 1 a cada 30 dias por irmão). */
export async function alertIncompleteRecords(now: Date = new Date()): Promise<{ lodges: number; membersEmailed: number; secretaryEmailed: number }> {
  const out = { lodges: 0, membersEmailed: 0, secretaryEmailed: 0 };
  const lodges = await prismaAdmin.lodge.findMany({ where: { status: 'active' }, select: { id: true } });
  for (const lodge of lodges) {
    try {
      const s = await sendIncompleteRecordNotices(lodge.id, { members: true, secretary: true, throttleDays: 30, now });
      if (s.incomplete > 0) out.lodges++;
      out.membersEmailed += s.membersEmailed;
      out.secretaryEmailed += s.secretaryEmailed;
    } catch (err) {
      console.error('cadastros incompletos: falha ao avisar', { lodgeId: lodge.id, err });
    }
  }
  return out;
}
