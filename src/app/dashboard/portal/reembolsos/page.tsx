import Link from 'next/link';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getActor } from '@/lib/reimbursement-server';
import { loadExpenseCharts, loadReimbursementViews } from '@/lib/reimbursement-view-server';
import ReimbursementBoard from '../../reembolsos/ReimbursementBoard';

// "Meus reembolsos": o irmão que pagou um gasto da loja do próprio bolso pede a devolução anexando a nota ou o recibo
// e acompanha o andamento (conferência da Tesouraria → decisão do Venerável → pagamento). Só os próprios pedidos.
export default async function MeusReembolsosPage() {
  const actor = await getActor();
  const blocked = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!actor) return blocked('Sessão expirada.');
  const access = await requireLodgeAccess(actor.lodgeId, actor.role, 'portal', 'read', actor.memberId);
  if (!access.ok) return blocked('Acesso negado.');
  if (!actor.memberId) return blocked('Este login não está ligado a um cadastro de membro. Entre com o seu login de obreiro para pedir reembolso.');
  if (actor.role === 'candidate') return blocked('O pedido de reembolso é para os irmãos da loja.');

  const data = await withTenant(actor.lodgeId, async (db) => {
    const [items, charts] = await Promise.all([loadReimbursementViews(db, actor, 'own'), loadExpenseCharts(db, actor.lodgeId)]);
    return { items, charts };
  });

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/dashboard/portal" className="text-xs text-gold hover:underline">← Voltar ao portal</Link>
          <h1 className="mt-2 font-display text-2xl font-bold text-sand-light">Meus reembolsos</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Pagou algo pela loja do próprio bolso? Peça o reembolso descrevendo o gasto e anexando a nota ou o recibo (um pedido para cada nota).
            A Tesouraria confere e o Venerável autoriza; você acompanha o andamento aqui e recebe um e-mail a cada passo.
          </p>
        </div>
        <ReimbursementBoard items={data.items} charts={data.charts} banks={[]} mode="portal" />
      </div>
    </main>
  );
}
