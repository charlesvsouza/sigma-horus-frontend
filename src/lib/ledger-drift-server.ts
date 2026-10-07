// Alerta diário: o saldo calculado até o dia conferido com o banco mudou DEPOIS da conferência (algum lançamento
// foi alterado por um caminho que a trava não cobre, ou um dado foi mexido direto). Avisa Tesoureiro, Venerável e
// Administradores uma única vez por conferência. Retificação aprovada em andamento não conta: a diferença é esperada.
import { brl } from '@/lib/currency';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { loadLedgerStatus } from '@/lib/ledger-lock-server';
import { prismaAdmin, withTenant } from '@/lib/prisma';

export async function alertLedgerDrift(): Promise<{ checked: number; drifted: number; emails: number }> {
  const lodges = await prismaAdmin.ledgerCheckpoint.findMany({ where: { undoneAt: null }, distinct: ['lodgeId'], select: { lodgeId: true } });
  const stats = { checked: lodges.length, drifted: 0, emails: 0 };
  for (const { lodgeId } of lodges) {
    try {
      const ctx = await withTenant(lodgeId, async (db) => {
        const status = await loadLedgerStatus(db, lodgeId);
        if (!status.checkpoint || status.drift.length === 0 || status.rectificationOpen) return null;
        const ref = `ledger-drift:${status.checkpoint.id}`;
        if (await db.messageLog.findFirst({ where: { lodgeId, ref }, select: { id: true } })) return null;
        const [lodge, staff] = await Promise.all([
          db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true } }),
          db.user.findMany({ where: { lodgeId, role: { in: ['treasurer', 'venerable', 'admin'] }, status: 'active' }, select: { email: true } }),
        ]);
        await db.messageLog.create({ data: { lodgeId, channel: 'email', title: 'Saldo mudou depois da conferência com o banco', content: status.drift.map((d) => `${d.name}: conferido ${brl(d.informed)}, hoje ${brl(d.calculated)}`).join(' | '), status: 'sent', ref } });
        return { status, lodge, staff };
      });
      if (!ctx) continue;
      stats.drifted++;
      const day = ctx.status.checkpoint!.throughKey.split('-').reverse().join('/');
      const lines = ctx.status.drift.map((d) => `• ${d.name}: conferido ${brl(d.informed)} · hoje, até ${day}, o sistema calcula ${brl(d.calculated)} (diferença ${brl(d.calculated - d.informed)})`).join('\n');
      const subject = `Saldo mudou depois da conferência — ${ctx.lodge?.name ?? 'sua loja'}`;
      const body = `O livro de ${ctx.lodge?.name ?? 'sua loja'} foi conferido com o banco até ${day}, mas o saldo calculado até esse dia não é mais o mesmo:\n\n${lines}\n\nAlgum lançamento com data até ${day} foi alterado depois da conferência. Confira o extrato em Tesouraria → Extratos de contas e, se a mudança foi legítima, registre uma nova conferência em Tesouraria → Conferência com o banco.`;
      for (const to of new Set(ctx.staff.map((u) => u.email).filter(Boolean))) {
        const r = await dispatch('email', to, subject, body, EMPTY_CHANNELS).catch(() => null);
        if (r?.status === 'sent') stats.emails++;
      }
    } catch (err) {
      console.error('conferência com o banco: falha ao checar desvio', { lodgeId, err });
    }
  }
  return stats;
}
