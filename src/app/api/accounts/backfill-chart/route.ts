import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Backfill do vínculo Account.chartAccountId para contas antigas (criadas antes
// do vínculo ao plano de contas). Sem isso, o balancete/balanço joga essas
// contas no balde genérico "Sem classificação". Escopo: a loja do usuário (RLS).
// Heurística conservadora: casa o título da conta com o nome de uma conta do
// plano (mesmo tipo: RECEIVABLE→REVENUE, PAYABLE→EXPENSE). Sem match → mantém NULL.

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    // remove marcas combinantes (acentos): faixa U+0300–U+036F
    .split('')
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp < 0x300 || cp > 0x36f;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

export async function POST() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const stats = { processed: 0, matched: 0, skipped: 0 };

  await withTenant(String(lodgeId), async (db) => {
    const [charts, accounts] = await Promise.all([
      db.chartAccount.findMany({
        where: { lodgeId: String(lodgeId), active: true },
        select: { id: true, name: true, type: true, code: true },
      }),
      db.account.findMany({
        where: { lodgeId: String(lodgeId), chartAccountId: null },
        select: { id: true, title: true, type: true, memberId: true },
      }),
    ]);

    // Índices por tipo do plano de contas.
    const byType = (t: 'REVENUE' | 'EXPENSE') => charts.filter((c) => c.type === t);
    // Fallback para mensalidades (receita de membro sem match explícito).
    const mensalidades = charts.find((c) => c.code === '1.1.01' || norm(c.name) === 'mensalidades');

    for (const acc of accounts) {
      stats.processed++;
      const targetType: 'REVENUE' | 'EXPENSE' = acc.type === 'RECEIVABLE' ? 'REVENUE' : 'EXPENSE';
      const candidates = byType(targetType);
      const title = norm(acc.title);

      // 1) match exato por nome
      let match = candidates.find((c) => norm(c.name) === title);
      // 2) match por conteúdo (um contém o outro), pegando o nome mais específico
      if (!match) {
        match = candidates
          .filter((c) => {
            const n = norm(c.name);
            return n.includes(title) || title.includes(n);
          })
          .sort((a, b) => b.name.length - a.name.length)[0];
      }
      // 3) fallback conservador: receita ligada a membro → Mensalidades
      if (!match && targetType === 'REVENUE' && acc.memberId && mensalidades) {
        match = mensalidades;
      }

      if (match) {
        await db.account.update({ where: { id: acc.id }, data: { chartAccountId: match.id } });
        stats.matched++;
      } else {
        stats.skipped++;
      }
    }

    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'account',
      entityId: 'backfill-chart',
      metadata: stats,
    });
  });

  return NextResponse.json({ ok: true, stats });
}
