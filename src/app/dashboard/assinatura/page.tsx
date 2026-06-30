import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { PLANS, type PlanId } from '@/lib/plans';
import { SubscriptionManager } from './SubscriptionManager';

function fmtDate(d: Date | null | undefined) {
  return d
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
    : '—';
}

const STATUS_LABEL: Record<string, string> = {
  trialing: 'Em teste',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
  inactive: 'Inativa',
  canceled: 'Cancelada',
};

export default async function AssinaturaPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  const sub = lodgeId
    ? await withTenant(String(lodgeId), (db) =>
        db.subscription.findUnique({ where: { lodgeId: String(lodgeId) } }),
      )
    : null;

  // Server Component: Date.now() roda 1× por request (falso-positivo da regra).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const trialEnds = sub?.trialEndsAt?.getTime() ?? null;
  const isTrialing = sub?.status === 'trialing' && trialEnds !== null && trialEnds > now;
  const isActiveCard = sub?.status === 'active' && !!sub?.stripeSubscriptionId;
  const currentPlan = (sub?.plan as PlanId | undefined) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-sand-light">Assinatura</h1>
      <p className="mt-2 text-sm text-sand-dark">
        Gerencie o plano da sua loja. Upgrades valem na hora; downgrades passam a valer no fim do
        período já pago (sem reembolso de valores).
      </p>

      {/* Resumo atual */}
      <div className="mt-8 grid gap-4 rounded-2xl border border-white/[0.08] bg-sigma-blue-dark/50 p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sand-dark">Plano atual</p>
          <p className="mt-1 text-lg font-semibold text-sand-light">
            {currentPlan ? PLANS[currentPlan].name : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sand-dark">Situação</p>
          <p className="mt-1 text-lg font-semibold text-sand-light">
            {sub ? STATUS_LABEL[sub.status] ?? sub.status : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sand-dark">
            {isTrialing ? 'Teste termina em' : sub?.currentPeriodEnd ? 'Renova/expira em' : 'Período'}
          </p>
          <p className="mt-1 text-lg font-semibold text-sand-light">
            {isTrialing ? fmtDate(sub?.trialEndsAt) : fmtDate(sub?.currentPeriodEnd)}
          </p>
        </div>
      </div>

      {sub?.pendingPlan ? (
        <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
          Downgrade para <strong>{PLANS[sub.pendingPlan as PlanId]?.name}</strong> agendado para{' '}
          {fmtDate(sub.pendingPlanEffectiveAt)}. Você mantém o plano atual até essa data.
        </div>
      ) : null}

      <SubscriptionManager
        currentPlan={currentPlan}
        isActiveCard={isActiveCard}
        pendingPlan={(sub?.pendingPlan as PlanId | null) ?? null}
      />
    </div>
  );
}
