import Link from 'next/link';
import { auth } from '@/lib/auth';
import { EmptyState } from '@/components/ui';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccessAny } from '@/lib/rbac';

// Chancelaria → Livro de presença: as sessões mais recentes, com atalho para marcar a presença, imprimir o livro
// e ver a lista de visitantes. Serve a quem tem a permissão 'attendance' (Chanceler, Secretário, Venerável, Administrador).
const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

export default async function ChancelariaPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const denied = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return denied('Sessão expirada.');
  const access = await requireLodgeAccessAny(lodgeId, session?.user?.role, ['attendance'], 'read', session?.user?.memberId);
  if (!access.ok) return denied('Acesso restrito à Chancelaria.');

  const sessions = await withTenant(lodgeId, (db) =>
    db.session.findMany({ where: { lodgeId }, orderBy: { date: 'desc' }, take: 40, select: { id: true, title: true, date: true } }),
  );

  const link = 'rounded-full border border-gold/40 px-3 py-1.5 text-xs font-medium text-gold transition hover:text-gold-light';
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Livro de presença</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Escolha a sessão para marcar a presença, imprimir o livro ou ver os visitantes. Para ver quem tem faltado, use <Link href="/dashboard/sessoes/frequencia" className="text-gold hover:text-gold-light">Frequência às sessões</Link>.
          </p>
        </div>

        {sessions.length === 0 ? (
          <EmptyState title="Nenhuma sessão cadastrada." description="As sessões são criadas pela Secretaria." />
        ) : (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/6 bg-sigma-card">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-sand-light">{s.title}</p>
                  <p className="mt-0.5 text-xs text-sand-dark">{fmtDate(s.date)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/sessoes/${s.id}`} className={link}>Marcar presença</Link>
                  <Link href={`/dashboard/sessoes/${s.id}/livro`} className={link}>Livro</Link>
                  <Link href={`/dashboard/sessoes/${s.id}/lista-visitantes`} className={link}>Visitantes</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
