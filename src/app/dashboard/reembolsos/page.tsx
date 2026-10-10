import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { canActAsStaff, getActor, isVenerableOrAdmin } from '@/lib/reimbursement-server';
import { loadBanks, loadExpenseCharts, loadReimbursementViews } from '@/lib/reimbursement-view-server';
import ReimbursementBoard from './ReimbursementBoard';

// Tesouraria → Reembolsos: pedidos dos irmãos que pagaram um gasto da loja do próprio bolso.
// Irmão pede (ou a Tesouraria digita por ele) → Tesouraria confere a nota → Venerável autoriza ou rejeita →
// a conta a pagar nasce com os dados do pedido → Tesouraria devolve o valor e registra o comprovante. Ver lib/reimbursement.ts.
export default async function ReembolsosPage() {
  const actor = await getActor();
  const denied = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!actor) return denied('Sessão expirada.');
  // Venerável tem leitura em Contas; o Tesoureiro e o Administrador, leitura e escrita.
  const access = await requireLodgeAccess(actor.lodgeId, actor.role, 'accounts', 'read', actor.memberId);
  if (!access.ok && !isVenerableOrAdmin(actor.role)) return denied('Acesso negado.');
  const staff = await canActAsStaff(actor);

  const data = await withTenant(actor.lodgeId, async (db) => {
    const [items, charts, banks, members] = await Promise.all([
      loadReimbursementViews(db, actor, 'staff'),
      loadExpenseCharts(db, actor.lodgeId),
      loadBanks(db, actor.lodgeId),
      staff ? db.member.findMany({ where: { lodgeId: actor.lodgeId, status: { in: ['active', 'blocked'] } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : Promise.resolve(undefined),
    ]);
    return { items, charts, banks, members };
  });

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Reembolsos</h1>
          <p className="mt-1 text-sm text-sand-dark">
            O irmão que pagou um gasto da loja do próprio bolso pede o reembolso anexando a nota ou o recibo — um pedido para cada nota. A Tesouraria confere e pede a liberação;
            o Venerável autoriza ou rejeita (com o motivo). Autorizado, nasce a conta a pagar com os dados do pedido, e a Tesouraria devolve o valor e anexa o comprovante do pagamento.
            Quando a Tesouraria digita o pedido pelo irmão, ele vai direto ao Venerável; quando o Venerável digita, a autorização já é implícita.
          </p>
        </div>
        <ReimbursementBoard items={data.items} charts={data.charts} banks={data.banks} members={data.members} mode="staff" />
      </div>
    </main>
  );
}
