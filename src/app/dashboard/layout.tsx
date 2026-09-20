import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccess, type Resource } from '@/lib/rbac';
import { Alert } from '@/components/ui';
import { subscriptionAccess } from '@/lib/subscription-access';
import { ART_002_THRESHOLD_DAYS, getMemberDuesStatus, isArt002Enabled } from '@/lib/overdue';
import DashboardShell from './DashboardShell';

interface NavEntry { href: string; label: string; roles: string[]; /** Se informado, o item aparece só para quem tem esta permissão (matriz de Permissões), em vez da lista fixa de papéis. */ resource?: Resource; }
interface NavSubgroupDef { label: string; items: NavEntry[]; }
interface NavGroupDef { category: string; items?: NavEntry[]; subgroups?: NavSubgroupDef[]; flat?: boolean; }

const NAV: NavGroupDef[] = [
  // "Visão geral" é um grupo solto (flat): os itens aparecem direto no menu,
  // sem precisar abrir um acordeão — são as telas mais acessadas por
  // qualquer papel (inclusive o obreiro comum), então cada clique a mais
  // pesa proporcionalmente mais aqui do que nas seções de gestão abaixo.
  {
    category: 'Visão geral',
    flat: true,
    items: [
      { href: '/dashboard', label: 'Visão geral', roles: ['admin', 'venerable', 'treasurer', 'secretary', 'member', 'hospitaller'] },
      { href: '/dashboard/portal', label: 'Meu portal', roles: ['admin', 'venerable', 'treasurer', 'secretary', 'member', 'hospitaller'] },
      // Todo oficial também é obreiro — o calendário de sessões vale pra
      // todos, não só pra quem tem papel "member".
      { href: '/dashboard/portal/secretaria', label: 'Calendário de sessões', roles: ['admin', 'venerable', 'treasurer', 'secretary', 'member', 'hospitaller'] },
      { href: '/manual', label: 'Manual & ajuda', roles: ['admin', 'venerable', 'treasurer', 'secretary', 'member', 'hospitaller'] },
    ],
  },
  // As 4 seções de gestão espelham os cargos da loja (mesma divisão que o
  // manual já usa por capítulo) — Secretaria concentra Membros/Cadastros/
  // Veneralato/Sessões/Social/Documentos, que antes viviam espalhados em
  // 3 categorias soltas ("Loja & cadastros", "Social", "Atividades").
  {
    category: 'Secretaria',
    subgroups: [
      {
        label: 'Membros & Cadastros',
        items: [
          { href: '/dashboard/membros', label: 'Membros', roles: ['admin', 'venerable', 'secretary', 'treasurer'] },
          { href: '/dashboard/cadastros', label: 'Cadastros mestre', roles: ['admin', 'venerable', 'secretary'] },
          { href: '/dashboard/materiais', label: 'Materiais e patrimônio', roles: ['admin', 'secretary'] },
          { href: '/dashboard/cargos', label: 'Cargos', roles: ['admin', 'venerable', 'secretary'] },
        ],
      },
      {
        label: 'Veneralato & Sessões',
        items: [
          { href: '/dashboard/veneralato', label: 'Veneralato', roles: ['admin', 'venerable', 'secretary'] },
          { href: '/dashboard/sessoes', label: 'Sessões', roles: ['admin', 'venerable', 'secretary'] },
          { href: '/dashboard/sessoes/frequencia', label: 'Frequência às sessões', roles: ['admin', 'venerable', 'secretary'] },
        ],
      },
      {
        label: 'Social',
        items: [
          { href: '/dashboard/membros/quadro-social', label: 'Quadro social', roles: ['admin', 'venerable', 'secretary'] },
          { href: '/dashboard/galeria-veneraveis', label: 'Galeria de Veneráveis', roles: ['admin', 'venerable', 'secretary'] },
          { href: '/dashboard/quadro-gestao', label: 'Quadro da Gestão', roles: ['admin', 'venerable', 'secretary'] },
        ],
      },
      {
        label: 'Documentos & Comunicação',
        items: [
          { href: '/dashboard/documentos', label: 'Documentos', roles: ['admin', 'venerable', 'secretary', 'treasurer'] },
          { href: '/dashboard/comunicacao', label: 'Comunicação', roles: ['admin', 'venerable', 'secretary', 'treasurer'] },
        ],
      },
    ],
  },
  {
    category: 'Tesouraria',
    subgroups: [
      {
        label: 'Entradas e Saídas',
        items: [
          { href: '/dashboard/contas', label: 'Contas', roles: ['admin', 'venerable', 'treasurer'] },
          { href: '/dashboard/cobrancas', label: 'Cobranças', roles: ['admin', 'treasurer'] },
          { href: '/dashboard/pagamentos', label: 'Pagamentos', roles: ['admin', 'treasurer'] },
          { href: '/dashboard/transferencias', label: 'Transferências entre contas', roles: ['admin', 'venerable', 'treasurer'] },
          { href: '/dashboard/extratos', label: 'Extratos de contas', roles: ['admin', 'venerable', 'treasurer'] },
        ],
      },
      {
        label: 'Cadastros e Conferência',
        items: [
          { href: '/dashboard/cadastros-financeiros', label: 'Cadastros financeiros', roles: ['admin', 'venerable', 'treasurer'] },
          { href: '/dashboard/conciliacao-bancaria', label: 'Conciliação bancária', roles: ['admin', 'treasurer'] },
          { href: '/dashboard/patrimonio', label: 'Patrimônio', roles: ['admin', 'venerable', 'treasurer'] },
        ],
      },
      {
        label: 'Relatórios',
        items: [
          { href: '/dashboard/relatorios', label: 'Resumo financeiro', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
          { href: '/dashboard/relatorios/contas-a-receber', label: 'Contas a receber', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
          { href: '/dashboard/relatorios/contas-a-pagar', label: 'Contas a pagar', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
          { href: '/dashboard/relatorios/contas-recebidas', label: 'Contas recebidas', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
          { href: '/dashboard/relatorios/contas-pagas', label: 'Contas pagas', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
          { href: '/dashboard/relatorios/dre', label: 'DRE comparativo', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
          { href: '/dashboard/relatorios/fechamento', label: 'Fechamento', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
          { href: '/dashboard/relatorios/inadimplencia', label: 'Inadimplência (Art. 002)', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
          { href: '/dashboard/relatorios/balancetes', label: 'Balancetes periódicos', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
          { href: '/dashboard/relatorios/fluxo-caixa', label: 'Fluxo de caixa projetado', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
          { href: '/dashboard/relatorios/orcamento', label: 'Orçamento anual', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
          { href: '/dashboard/relatorios/tarifas', label: 'Tarifas de cobrança (Asaas)', roles: ['admin', 'venerable', 'treasurer'] },
        ],
      },
    ],
  },
  {
    category: 'Hospitalaria',
    items: [
      { href: '/dashboard/hospitalaria/irmaos', label: 'Irmãos (consulta)', roles: ['admin', 'venerable', 'hospitaller'] },
      { href: '/dashboard/hospitalaria/campanhas', label: 'Campanhas', roles: ['admin', 'venerable', 'hospitaller', 'treasurer'] },
      { href: '/dashboard/hospitalaria/fundos', label: 'Fundos (Tronco e Doações)', roles: ['admin', 'venerable', 'hospitaller', 'treasurer'] },
      { href: '/dashboard/portal/hospitalaria', label: 'Hospitalaria', roles: ['member'] },
    ],
  },
  {
    category: 'Administração',
    items: [
      { href: '/dashboard/configuracoes', label: 'Configurações da loja', roles: ['admin'] },
      { href: '/dashboard/configuracoes/usuarios', label: 'Usuários & acessos', roles: ['admin'] },
      { href: '/dashboard/configuracoes/importar', label: 'Importar cadastros', roles: ['admin', 'secretary'] },
      { href: '/dashboard/configuracoes/importar-financeiro', label: 'Importar backup financeiro', roles: ['admin', 'treasurer'] },
      { href: '/dashboard/assinatura', label: 'Assinatura', roles: ['admin'] },
      { href: '/dashboard/integracoes', label: 'Integrações', roles: ['admin'] },
      { href: '/dashboard/auditoria', label: 'Auditoria', roles: [], resource: 'audit' },
    ],
  },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Guarda de sessão: sem login (ex.: após "Sair" + voltar do navegador), volta
  // sempre para a tela de login em vez de mostrar conteúdo autenticado.
  if (!session?.user) {
    redirect('/login');
  }
  // 1º acesso com senha provisória: força a troca antes de entrar no painel.
  if (session.user.mustChangePassword) {
    redirect('/trocar-senha');
  }
  const lodgeId = session?.user?.lodgeId;
  const role = (session?.user?.role ?? 'member').toLowerCase();

  let lodgeName = 'Minha loja';
  let sub: {
    status: string;
    plan: string;
    trialEndsAt: Date | null;
    pendingPlan: string | null;
    pendingPlanEffectiveAt: Date | null;
  } | null = null;
  let art002DaysOverdue: number | null = null;
  const memberId = session?.user?.memberId;
  if (lodgeId) {
    const data = await withTenant(String(lodgeId), async (db) => {
      const [lodge, subscription, dues] = await Promise.all([
        db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, art002Enabled: true } }),
        db.subscription.findUnique({
          where: { lodgeId: String(lodgeId) },
          select: { status: true, plan: true, trialEndsAt: true, pendingPlan: true, pendingPlanEffectiveAt: true },
        }),
        memberId ? getMemberDuesStatus(db, String(lodgeId), String(memberId)) : Promise.resolve(null),
      ]);
      return { lodge, subscription, dues };
    });
    if (data.lodge?.name) lodgeName = data.lodge.name;
    sub = data.subscription;
    // Só avisa o próprio membro quando já cruzou o prazo do Art. 002 (60 dias)
    // e a loja tem a régua automática ligada; mensalidade em atraso mas ainda
    // dentro do prazo, ou loja com o Art. 002 desligado, não dispara o popup.
    if (isArt002Enabled(data.lodge) && data.dues && data.dues.daysOverdue > ART_002_THRESHOLD_DAYS) {
      art002DaysOverdue = data.dues.daysOverdue;
    }
  }

  // Server Component: roda 1× por request; Date.now() é determinístico no escopo
  // da request (falso-positivo da regra de impureza, que mira componentes cliente).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const trialEnds = sub?.trialEndsAt ? sub.trialEndsAt.getTime() : null;
  const trialDaysLeft = trialEnds ? Math.ceil((trialEnds - now) / (24 * 60 * 60 * 1000)) : 0;
  const isTrialing = sub?.status === 'trialing' && trialEnds !== null && trialEnds > now;
  const isActive = sub?.status === 'active';
  const access = subscriptionAccess(sub, now); // mesma regra que a API usa para travar escrita
  const trialExpired = access.reason === 'trial_expired';
  const blocked = access.blocked; // inativo, trial expirado, etc.

  const fmtDate = (d: Date | null) =>
    d ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d) : '';

  // Itens ligados a uma permissão da matriz (ex.: Auditoria) aparecem só para quem a tem.
  const allowedResources = new Set<string>();
  for (const resource of ['audit'] as const) {
    if (await canLodgeAccess(lodgeId ? String(lodgeId) : null, role, resource, 'read')) allowedResources.add(resource);
  }
  const visible = (i: NavEntry) => (i.resource ? allowedResources.has(i.resource) : i.roles.includes(role));

  const groups = NAV
    .map((g) => ({
      category: g.category,
      flat: g.flat ?? false,
      items: (g.items ?? []).filter(visible).map(({ href, label }) => ({ href, label })),
      subgroups: (g.subgroups ?? [])
        .map((sg) => ({ label: sg.label, items: sg.items.filter(visible).map(({ href, label }) => ({ href, label })) }))
        .filter((sg) => sg.items.length > 0),
    }))
    .filter((g) => g.items.length > 0 || g.subgroups.length > 0);

  return (
    <>
      {/* Aplica o tema salvo antes da pintura, só dentro do dashboard (evita flash). */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var t=localStorage.getItem('sigma-theme');if(t==='light'||t==='system')document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
        }}
      />
      <DashboardShell groups={groups} lodgeName={lodgeName} userName={session?.user?.name ?? 'Usuário'} role={role} art002DaysOverdue={art002DaysOverdue}>
      {blocked ? (
        <Alert variant="banner" intent="danger">
          {trialExpired
            ? 'Seu período de teste terminou. Assine um plano para continuar usando o Sigma Horus.'
            : 'Sua loja não possui uma assinatura ativa.'}{' '}
          <a href="/dashboard/assinatura" className="font-medium underline hover:text-rose-100">Assinar agora</a>
        </Alert>
      ) : isTrialing ? (
        <div className="border-b border-gold/30 bg-gold/10 px-6 py-3 text-center text-sm text-gold">
          Período de teste: {trialDaysLeft} {trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'}.{' '}
          <a href="/dashboard/assinatura" className="font-medium underline hover:text-gold-light">Escolher plano</a>
        </div>
      ) : isActive && sub?.pendingPlan ? (
        <Alert variant="banner" intent="info">
          Downgrade agendado para {fmtDate(sub.pendingPlanEffectiveAt)}. Você mantém o plano atual até lá.
        </Alert>
      ) : null}
      {children}
      </DashboardShell>
    </>
  );
}
