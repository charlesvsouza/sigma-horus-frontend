'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/* Índice (espelha os capítulos abaixo — manter em sincronia)         */
/* ------------------------------------------------------------------ */

interface IndexEntry {
  id: string;
  num: string;
  label: string;
  sub?: { id: string; label: string }[];
}

const INDEX: IndexEntry[] = [
  { id: 'apresentacao', num: '1', label: 'Apresentação' },
  { id: 'primeiros-passos', num: '2', label: 'Primeiros passos' },
  { id: 'papeis', num: '3', label: 'Papéis de acesso (RBAC)' },
  { id: 'navegacao', num: '4', label: 'A navegação e o menu lateral' },
  { id: 'luzes', num: '5', label: 'As Luzes e os oficiais' },
  {
    id: 'admin',
    num: '6',
    label: 'Guia do Administrador',
    sub: [
      { id: 'admin-loja', label: '6.1 Configurações da loja' },
      { id: 'admin-asaas', label: '6.2 Conectar o Asaas' },
      { id: 'admin-usuarios', label: '6.3 Convidar usuários' },
      { id: 'admin-permissoes', label: '6.4 Permissões' },
      { id: 'admin-assinatura', label: '6.5 Assinatura' },
      { id: 'admin-comunicacao', label: '6.6 Comunicação (WhatsApp/SMS)' },
      { id: 'admin-importar', label: '6.7 Importar cadastro de outro sistema' },
      { id: 'admin-backup', label: '6.8 Backup dos dados da loja' },
    ],
  },
  {
    id: 'tesoureiro',
    num: '7',
    label: 'Guia do Tesoureiro',
    sub: [
      { id: 'tes-plano', label: '7.1 Plano de contas' },
      { id: 'tes-contas', label: '7.2 Contas a receber e pagar' },
      { id: 'tes-cobrancas', label: '7.3 Cobranças e recorrência' },
      { id: 'tes-asaas', label: '7.4 Emitir boleto/PIX' },
      { id: 'tes-pagamentos', label: '7.5 Registrar pagamentos' },
      { id: 'tes-relatorios', label: '7.6 Relatórios' },
      { id: 'tes-fechamento', label: '7.7 Fechamento do veneralato' },
      { id: 'tes-inadimplencia', label: '7.8 Inadimplência, Art. 002 e renegociação' },
      { id: 'tes-aprovacao', label: '7.9 Aprovação de despesas e multa/juros' },
      { id: 'tes-balancetes', label: '7.10 Balancetes periódicos' },
      { id: 'tes-gerencial', label: '7.11 Fluxo de caixa, orçamento e patrimônio' },
      { id: 'tes-conciliacao', label: '7.12 Conciliação (Asaas e extrato bancário)' },
      { id: 'tes-clientes-fornecedores', label: '7.13 Clientes e fornecedores' },
      { id: 'tes-contas-bancarias', label: '7.14 Contas bancárias, Caixa e transferências' },
      { id: 'tes-extratos', label: '7.15 Extratos de contas' },
      { id: 'tes-dre', label: '7.16 DRE comparativo entre períodos' },
    ],
  },
  {
    id: 'secretario',
    num: '8',
    label: 'Guia do Secretário',
    sub: [
      { id: 'sec-membros', label: '8.1 Membros' },
      { id: 'sec-quadro-social', label: '8.2 Quadro social' },
      { id: 'sec-galeria-veneraveis', label: '8.3 Galeria de Veneráveis' },
      { id: 'sec-quadro-gestao', label: '8.4 Quadro da Gestão' },
      { id: 'sec-cadastros-mestre', label: '8.5 Cadastros mestre e cargos' },
      { id: 'sec-veneralato', label: '8.6 Veneralato' },
      { id: 'sec-sessoes', label: '8.7 Sessões e convocação' },
      { id: 'sec-frequencia', label: '8.8 Frequência às sessões' },
      { id: 'sec-materiais', label: '8.9 Materiais e patrimônio' },
      { id: 'sec-documentos', label: '8.10 Documentos e comunicação' },
    ],
  },
  { id: 'veneravel', num: '9', label: 'Guia do Venerável' },
  {
    id: 'membro',
    num: '10',
    label: 'Guia do Membro (obreiro)',
    sub: [
      { id: 'membro-acesso', label: '10.1 Seu acesso e seus dados' },
      { id: 'membro-secretaria', label: '10.2 Calendário de sessões' },
      { id: 'membro-hospitalaria', label: '10.3 Hospitalaria' },
    ],
  },
  {
    id: 'hospitaleiro',
    num: '11',
    label: 'Guia do Hospitaleiro',
    sub: [
      { id: 'hosp-irmaos', label: '11.1 Irmãos (consulta)' },
      { id: 'hosp-tronco', label: '11.2 O Tronco de Solidariedade' },
      { id: 'hosp-campanha', label: '11.3 Criar uma campanha' },
      { id: 'hosp-doacoes', label: '11.4 Doações e custeio pelo Tronco' },
      { id: 'hosp-convocar', label: '11.5 Convocar os irmãos' },
      { id: 'hosp-pedidos', label: '11.6 Pedidos dos obreiros' },
    ],
  },
  { id: 'assinatura', num: '12', label: 'Assinatura e cobrança' },
  { id: 'regras', num: '13', label: 'Reembolso, upgrade e downgrade' },
  { id: 'seguranca', num: '14', label: 'Privacidade, segurança e LGPD' },
  { id: 'duvidas', num: '15', label: 'Dúvidas frequentes' },
];

/* ------------------------------------------------------------------ */
/* Componentes auxiliares de conteúdo                                 */
/* ------------------------------------------------------------------ */

function Chapter({ id, num, title, children }: { id: string; num: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="manual-chapter scroll-mt-24">
      <h2 className="manual-h2 flex items-baseline gap-3 border-b border-white/[0.08] pb-3 text-2xl font-bold text-sand-light">
        <span className="text-gold">{num}.</span>
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-[0.95rem] leading-7 text-sand">{children}</div>
    </section>
  );
}

function Sub({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 pt-2">
      <h3 className="manual-h3 text-lg font-semibold text-sand-light">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

/** Passo a passo numerado. */
function Steps({ children }: { children: ReactNode }) {
  return <ol className="manual-steps list-decimal space-y-2 pl-5 marker:font-semibold marker:text-gold">{children}</ol>;
}

function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

/** UI de botão/campo mencionado no texto. */
function UI({ children }: { children: ReactNode }) {
  return (
    <span className="manual-ui rounded border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-[0.8em] font-medium text-gold">
      {children}
    </span>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="manual-note rounded-lg border border-gold/20 bg-gold/[0.06] px-4 py-3 text-sm text-sand">
      <strong className="text-gold">Dica:</strong> {children}
    </p>
  );
}

function Office({ name, light, tradition, system }: { name: string; light?: boolean; tradition: string; system: string }) {
  return (
    <div className="manual-card rounded-xl border border-white/[0.08] bg-sigma-blue-dark/40 p-5">
      <h4 className="flex items-center gap-2 text-base font-semibold text-sand-light">
        {name}
        {light ? (
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-gold">
            Luz da loja
          </span>
        ) : null}
      </h4>
      <p className="mt-2 text-sm leading-6 text-sand">{tradition}</p>
      <p className="mt-2 text-sm leading-6 text-sand-dark">
        <strong className="text-sand">No Sigma Horus:</strong> {system}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CSS de impressão — formato de livro acadêmico                      */
/* ------------------------------------------------------------------ */

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 24mm 22mm 22mm 22mm; }
  html, body { background: #ffffff !important; }
  body * { visibility: hidden !important; }
  .manual-print, .manual-print * { visibility: visible !important; }
  .manual-print {
    position: absolute; left: 0; top: 0; width: 100%;
    color: #1b1b1b !important;
    background: #ffffff !important;
    font-family: Georgia, "Times New Roman", serif !important;
    font-size: 11.5pt; line-height: 1.55;
  }
  .manual-noprint { display: none !important; }
  .manual-print h1, .manual-print h2, .manual-print h3, .manual-print h4 {
    color: #111 !important; font-family: Georgia, "Times New Roman", serif !important;
  }
  .manual-print .manual-h2 { border-bottom: 1px solid #999 !important; }
  .manual-print a { color: #111 !important; text-decoration: none !important; }
  .manual-print .manual-ui {
    background: transparent !important; border: 1px solid #999 !important; color: #111 !important;
  }
  .manual-print .manual-note {
    background: #f4f1e8 !important; border: 1px solid #cdbf94 !important; color: #2a2a2a !important;
  }
  .manual-print .manual-note strong { color: #6b551d !important; }
  .manual-print .manual-card { background: #fafafa !important; border: 1px solid #ccc !important; }
  .manual-print .manual-card * { color: #1b1b1b !important; }
  .manual-print .manual-card span { background: transparent !important; border-color: #999 !important; color: #333 !important; }
  .manual-print .manual-chapter { break-before: page; page-break-before: always; }
  .manual-print .manual-cover { break-after: page; page-break-after: always; }
  .manual-print .manual-toc { break-after: page; page-break-after: always; }
  .manual-print .manual-toc li { break-inside: avoid; }
  .manual-print .manual-chapter h2 span { color: #6b551d !important; }
  .manual-print .manual-steps { color: #1b1b1b !important; }
}
`;

/* ------------------------------------------------------------------ */
/* Componente principal                                               */
/* ------------------------------------------------------------------ */

export function ManualBook() {
  const [openIdx, setOpenIdx] = useState(false);
  const router = useRouter();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-14">
        {/* Barra de ações (não imprime) */}
        <div className="manual-noprint mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-sand-dark transition-colors hover:text-gold"
              aria-label="Voltar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Voltar
            </button>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Guia do usuário</p>
            <h1 className="mt-2 text-3xl font-bold text-sand-light lg:text-4xl">Manual do Sigma Horus</h1>
            <p className="mt-1 text-sm text-sand-dark">Atualizado em 18 de setembro de 2026 · versão 1.22</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpenIdx((v) => !v)}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-sand-light transition-colors hover:border-white/30 lg:hidden"
            >
              {openIdx ? 'Fechar índice' : 'Índice'}
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light"
            >
              Salvar como PDF
            </button>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
          {/* ---------- Índice lateral ---------- */}
          <aside className={`manual-noprint ${openIdx ? 'block' : 'hidden'} lg:block`}>
            <nav className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-sand-dark">Sumário</p>
              <ul className="space-y-1 border-l border-white/[0.08] text-sm">
                {INDEX.map((entry) => (
                  <li key={entry.id}>
                    <a
                      href={`#${entry.id}`}
                      onClick={() => setOpenIdx(false)}
                      className="-ml-px block border-l border-transparent py-1.5 pl-4 text-sand-dark transition-colors hover:border-gold hover:text-sand-light"
                    >
                      <span className="text-gold/70">{entry.num}.</span> {entry.label}
                    </a>
                    {entry.sub ? (
                      <ul className="mb-1 space-y-0.5">
                        {entry.sub.map((s) => (
                          <li key={s.id}>
                            <a
                              href={`#${s.id}`}
                              onClick={() => setOpenIdx(false)}
                              className="block py-1 pl-8 text-[0.8rem] text-sand-dark/80 transition-colors hover:text-sand-light"
                            >
                              {s.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* ---------- Frame central (conteúdo + impressão) ---------- */}
          <article className="manual-print min-w-0 space-y-12">
            {/* Capa (só na impressão) */}
            <div className="manual-cover hidden print:block" aria-hidden="true">
              <div style={{ paddingTop: '6cm', textAlign: 'center' }}>
                <p style={{ letterSpacing: '0.3em', fontSize: '12pt' }}>SIGMA HORUS</p>
                <p style={{ fontSize: '30pt', margin: '1.5cm 0 0.4cm', color: '#111' }}>Manual do Usuário</p>
                <p style={{ fontSize: '13pt', fontStyle: 'italic' }}>A tesouraria da sua loja no prumo</p>
                <p style={{ marginTop: '4cm', fontSize: '11pt' }}>Versão 1.22 — 18 de setembro de 2026</p>
              </div>
            </div>

            {/* Sumário (só na impressão — o índice lateral interativo não imprime) */}
            <div className="manual-toc hidden print:block" aria-hidden="true">
              <h2 style={{ fontSize: '20pt', marginBottom: '1cm', textAlign: 'center' }}>Sumário</h2>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '11.5pt', lineHeight: 1.9 }}>
                {INDEX.map((entry) => (
                  <li key={entry.id} style={{ marginBottom: '0.3cm' }}>
                    <strong>{entry.num}.</strong> {entry.label}
                    {entry.sub ? (
                      <ul style={{ listStyle: 'none', padding: 0, paddingLeft: '1.2cm' }}>
                        {entry.sub.map((s) => (
                          <li key={s.id} style={{ fontSize: '10.5pt', opacity: 0.85 }}>{s.label}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            {/* ============== 1. APRESENTAÇÃO ============== */}
            <Chapter id="apresentacao" num="1" title="Apresentação">
              <p>
                O <strong>Sigma Horus</strong> é a plataforma de gestão administrativa e financeira da sua loja
                maçônica, com foco em tesouraria e cobrança. Este manual ensina, passo a passo, como cada perfil de
                usuário usa o sistema no dia a dia.
              </p>
              <p>Como ler este manual:</p>
              <Bullets>
                <li>Comece pelos capítulos <strong>2 a 4</strong> (primeiros passos, papéis e navegação) — valem para todos.</li>
                <li>Depois vá direto ao <strong>guia do seu perfil</strong>: Administrador (6), Tesoureiro (7), Secretário (8), Venerável (9), Membro (10) ou Hospitaleiro (11).</li>
                <li>Os termos em destaque como <UI>Botão</UI> indicam exatamente o que aparece na tela.</li>
              </Bullets>
              <Note>
                Use o botão <strong>Salvar como PDF</strong> no topo da página para gerar uma versão em formato de livro,
                pronta para imprimir ou arquivar.
              </Note>
            </Chapter>

            {/* ============== 2. PRIMEIROS PASSOS ============== */}
            <Chapter id="primeiros-passos" num="2" title="Primeiros passos">
              <p>Há <strong>duas formas</strong> de a loja entrar no Sigma Horus:</p>
              <p><strong>A) Autocadastro pelo site (recomendado):</strong></p>
              <Steps>
                <li>Na página inicial (<code>sigmahorus.com.br</code>), escolha um plano e clique em <UI>Assinar agora</UI>.</li>
                <li>Você é levado ao <strong>checkout seguro</strong>, informa o cartão e ganha <strong>10 dias de teste grátis</strong> — nada é cobrado agora.</li>
                <li>De volta ao site, na tela <UI>Quase lá</UI>, crie a loja: nome, endereço (slug), seu nome, e-mail, senha e o <strong>rito praticado</strong>.</li>
                <li>Pronto: a loja já nasce no período de teste, ligada ao seu plano. Ao fim dos 10 dias, a cobrança ocorre automaticamente <strong>se você não cancelar</strong>.</li>
              </Steps>
              <p><strong>B) Por convite</strong> (quando a loja recebe um código da equipe):</p>
              <Steps>
                <li>Abra o link do convite (<code>/onboarding?invite=SEU-CÓDIGO</code>) ou informe o código na tela de criação de loja.</li>
                <li>Informe o <strong>nome da loja</strong>, escolha o <strong>rito praticado</strong> e crie o administrador (nome, e-mail e senha).</li>
              </Steps>
              <p>
                Em qualquer caminho, a loja já nasce semeada com ritos, potências, os <strong>cargos do rito escolhido</strong>
                e um <strong>plano de contas</strong> padrão, e começa o <strong>período de teste de 10 dias</strong> com
                acesso completo (um aviso no topo do painel mostra os dias restantes).
              </p>
              <Note>
                No autocadastro, a cobrança é automática ao fim do teste; gerencie ou cancele em <UI>Administração →
                Assinatura</UI>. Sem assinatura ativa, o acesso é pausado, mas <strong>seus dados permanecem guardados</strong>.
              </Note>

              <Sub id="checklist-config" title="Checklist de configuração inicial (Administrador)">
                <p>
                  Um roteiro sugerido para deixar a loja pronta pra operar — cada item leva à seção com o passo a passo
                  completo. Não é uma ordem obrigatória, só a sequência que costuma fazer mais sentido.
                </p>
                <Steps>
                  <li>
                    <strong>Configure a loja:</strong> identificação, dados bancários, rito/potência e dias das sessões
                    — <Link className="text-gold hover:text-gold-light" href="#admin-loja">6.1 Configurações da loja</Link>.
                  </li>
                  <li>
                    <strong>Confira cargos e o período de gestão:</strong> os cargos do rito escolhido já vêm prontos;
                    ajuste se precisar e vincule os oficiais em <Link className="text-gold hover:text-gold-light" href="#sec-veneralato">Veneralato</Link> (também em <Link className="text-gold hover:text-gold-light" href="#sec-cadastros-mestre">Cadastros mestre e cargos</Link>).
                  </li>
                  <li>
                    <strong>Cadastre os membros:</strong> um a um em <Link className="text-gold hover:text-gold-light" href="#sec-membros">Membros</Link>, ou de uma vez
                    só se estiver migrando de outro sistema — <Link className="text-gold hover:text-gold-light" href="#admin-importar">6.7 Importar cadastro</Link>.
                  </li>
                  <li>
                    <strong>Conceda acesso aos obreiros</strong> que vão usar o sistema (login por e-mail) —{' '}
                    <Link className="text-gold hover:text-gold-light" href="#admin-usuarios">6.3 Acesso dos obreiros</Link>.
                  </li>
                  <li>
                    <strong>Ajuste as permissões</strong>, se algum papel precisar de um acesso diferente do padrão —{' '}
                    <Link className="text-gold hover:text-gold-light" href="#admin-permissoes">6.4 Permissões</Link>.
                  </li>
                  <li>
                    <strong>Conecte o Asaas</strong> para emitir boleto/PIX e receber direto na conta da loja —{' '}
                    <Link className="text-gold hover:text-gold-light" href="#admin-asaas">6.2 Conectar o Asaas</Link>.
                  </li>
                  <li>
                    <strong>Confira o plano de contas</strong> (já vem com um padrão pronto) e ajuste conforme a
                    realidade da loja — <Link className="text-gold hover:text-gold-light" href="#tes-plano">7.1 Plano de contas</Link>.
                  </li>
                  <li>
                    <strong>Cadastre os bancos e o Caixa</strong> que a loja usa de verdade, para saber o saldo de cada
                    um e poder transferir entre eles — <Link className="text-gold hover:text-gold-light" href="#tes-contas-bancarias">7.14 Contas bancárias, Caixa e transferências</Link>.
                  </li>
                  <li>
                    <strong>Conecte WhatsApp/SMS</strong>, se quiser esses canais além do e-mail (que já funciona sem
                    configuração) — <Link className="text-gold hover:text-gold-light" href="#admin-comunicacao">6.6 Comunicação</Link>.
                  </li>
                  <li>
                    <strong>Acompanhe a assinatura:</strong> o teste de 10 dias e o plano contratado depois dele —{' '}
                    <Link className="text-gold hover:text-gold-light" href="#admin-assinatura">6.5 Assinatura</Link>.
                  </li>
                  <li>
                    <strong>Baixe um backup inicial</strong> dos dados da loja, pra guardar num lugar seu —{' '}
                    <Link className="text-gold hover:text-gold-light" href="#admin-backup">6.8 Backup dos dados da loja</Link>.
                  </li>
                </Steps>
              </Sub>
            </Chapter>

            {/* ============== 3. PAPÉIS ============== */}
            <Chapter id="papeis" num="3" title="Papéis de acesso (RBAC)">
              <p>
                O acesso é controlado por <strong>papel × recurso × ação</strong>: cada usuário só vê e faz o que o seu
                papel permite, e sempre dentro da sua loja (isolamento por <em>tenant</em>). O Administrador atribui os
                papéis.
              </p>
              <Bullets>
                <li><strong>Administrador:</strong> conta, usuários, assinatura, integrações e configurações.</li>
                <li><strong>Venerável:</strong> visão gerencial completa, relatórios e aprovações (despesas, prestação de contas e transferências entre contas bancárias); não lança baixas financeiras.</li>
                <li><strong>Tesoureiro:</strong> lança e baixa contas, emite cobranças, fecha o caixa, solicita transferências entre contas bancárias/Caixa e vê relatórios financeiros.</li>
                <li><strong>Secretário:</strong> membros, cargos, períodos, sessões e presença, materiais e patrimônio da loja, documentos institucionais; relatórios não financeiros.</li>
                <li><strong>Hospitaleiro:</strong> consulta os irmãos (somente leitura, para contato), gerencia campanhas de benemerência e acompanha o Tronco de Solidariedade.</li>
                <li><strong>Membro (obreiro):</strong> o próprio portal — extrato, débitos, histórico e documentos pertinentes.</li>
              </Bullets>
              <p className="text-sm text-sand-dark">
                O <strong>cargo maçônico</strong> (registrado em Cargos e Veneralato) é o registro cerimonial; o
                <strong> papel de acesso</strong> é o que define as permissões no sistema. A loja decide qual papel cada
                oficial recebe — e pode ajustar a matriz de permissões (ver 6.4).
              </p>
            </Chapter>

            {/* ============== 4. NAVEGAÇÃO ============== */}
            <Chapter id="navegacao" num="4" title="A navegação e o menu lateral">
              <p>
                Depois de entrar, você vê o painel com um <strong>menu lateral</strong> organizado por categorias. Cada
                usuário enxerga apenas os itens permitidos ao seu papel.
              </p>
              <p>
                O menu tem dois tipos de entrada: <strong>itens soltos</strong>, sempre visíveis sem precisar abrir
                nada (uso frequente por qualquer papel), e <strong>seções</strong> em acordeão — uma aberta por vez —
                que espelham os quatro cargos de gestão da loja (mesma divisão dos capítulos 6 a 9 deste manual).
              </p>
              <Bullets>
                <li><strong>Itens soltos (Visão geral):</strong> <UI>Visão geral</UI> (indicadores), <UI>Meu portal</UI>, <UI>Calendário de sessões</UI> (vale pra todo oficial, não só o obreiro) e <UI>Manual &amp; ajuda</UI>.</li>
                <li>
                  <strong>Secretaria:</strong> dividida em quatro grupos — <UI>Membros &amp; Cadastros</UI>
                  (<UI>Membros</UI>, <UI>Cadastros mestre</UI>, <UI>Materiais e patrimônio</UI>, <UI>Cargos</UI>),
                  <UI> Veneralato &amp; Sessões</UI> (<UI>Veneralato</UI>, <UI>Sessões</UI>, <UI>Frequência às
                  sessões</UI>), <UI>Social</UI> (<UI>Quadro social</UI>, <UI>Galeria de Veneráveis</UI>, <UI>Quadro
                  da Gestão</UI>) e <UI>Documentos &amp; Comunicação</UI> (<UI>Documentos</UI>, <UI>Comunicação</UI>).
                  Os grupos são só rótulos visuais dentro do menu já aberto — não precisam de um clique a mais.
                </li>
                <li>
                  <strong>Tesouraria:</strong> dividida em três grupos — <UI>Entradas e Saídas</UI> (<UI>Contas</UI>,
                  <UI> Cobranças</UI>, <UI>Pagamentos</UI>, <UI>Transferências entre contas</UI>, <UI>Extratos de
                  contas</UI>), <UI>Cadastros e Conferência</UI> (<UI>Cadastros financeiros</UI>, <UI>Conciliação
                  bancária</UI>, <UI>Patrimônio</UI>) e <UI>Relatórios</UI> (<UI>Resumo financeiro</UI>, <UI>DRE
                  comparativo</UI>, <UI>Fechamento</UI>, <UI>Inadimplência (Art. 002)</UI>, <UI>Balancetes
                  periódicos</UI>, <UI>Fluxo de caixa projetado</UI>, <UI>Orçamento anual</UI>).
                </li>
                <li><strong>Hospitalaria:</strong> <UI>Irmãos (consulta)</UI> e <UI>Campanhas</UI> de benemerência.</li>
                <li><strong>Administração:</strong> <UI>Configurações da loja</UI>, <UI>Usuários &amp; acessos</UI>, <UI>Importar cadastros</UI>, <UI>Assinatura</UI>, <UI>Integrações</UI>, <UI>Auditoria</UI>.</li>
              </Bullets>
              <p>O topo mostra o nome da loja, o usuário logado e o status da assinatura (teste, ativa ou pendente).</p>
              <p>
                <strong>Cada item tem um ícone</strong> para você reconhecer a tela de relance, e o item da página
                em que você está fica destacado em ouro.
              </p>
              <p>
                <strong>O menu fica sempre visível:</strong> no computador ele é fixo à esquerda, então apenas o
                conteúdo rola, a barra não some. Para ganhar espaço, clique em <UI>Recolher menu</UI> no rodapé da
                barra: ela fica compacta (só os ícones) e, ao passar o mouse sobre um ícone, o nome aparece. No
                celular, o menu abre pelo botão de menu (☰) e cobre a tela enquanto você escolhe.
              </p>
              <p>
                <strong>Uma categoria por vez:</strong> ao abrir uma seção (Secretaria, Tesouraria, Hospitalaria ou
                Administração), a anterior se fecha sozinha — assim a lista não fica longa e poluída. A seção da tela
                em que você está já abre automaticamente. Os <strong>itens soltos</strong> de Visão geral não entram
                nesse acordeão — ficam sempre à mostra, sem nenhum clique.
              </p>
              <p>
                <strong>Busca rápida (atalho):</strong> pressione <UI>Ctrl + K</UI> (ou <UI>⌘ + K</UI> no Mac), ou
                clique em <UI>Buscar</UI> no topo, para abrir a <strong>paleta de comandos</strong>. Digite o nome de
                uma tela, use as setas para escolher e <UI>Enter</UI> para ir direto — sem precisar do mouse.
              </p>
              <p>
                <strong>Tema da interface:</strong> escolha entre Escuro, Papiro ou Sistema em <UI>Configurações →
                Aparência</UI> — detalhes em <Link className="text-gold hover:text-gold-light" href="#admin-loja">6.1 Configurações da loja</Link>.
              </p>
            </Chapter>

            {/* ============== 5. LUZES ============== */}
            <Chapter id="luzes" num="5" title="As Luzes e os oficiais da loja">
              <p>
                Tradicionalmente, as <strong>três Luzes</strong> que governam a loja são o Venerável Mestre e os dois
                Vigilantes; junto deles, os oficiais conduzem a secretaria, a tesouraria, a chancelaria e a hospitalaria.
                Abaixo, o papel de cada um e como ele se reflete no Sigma Horus.
              </p>
              <div className="grid gap-4">
                <Office name="Venerável Mestre" light tradition="Preside e governa os trabalhos da loja, máxima autoridade da gestão durante o veneralato." system="Costuma receber o papel Venerável (visão gerencial, relatórios e aprovações). Quando também administra a conta, acumula o papel Administrador." />
                <Office name="1º Vigilante" light tradition="Segunda Luz, dirige a Coluna dos Companheiros e substitui o Venerável em seus impedimentos." system="Em geral papel Membro (com portal próprio) ou ampliado, conforme a loja decidir." />
                <Office name="2º Vigilante" light tradition="Terceira Luz, dirige a Coluna dos Aprendizes e zela pela instrução dos obreiros mais novos." system="Normalmente papel Membro; apoia o acompanhamento de presença e frequência." />
                <Office name="Orador" tradition="Guardião da lei e da justiça nos trabalhos; zela pelo cumprimento dos estatutos." system="Papel Membro, com leitura do que lhe couber; apoia-se na auditoria e nos relatórios." />
                <Office name="Secretário" tradition="A administração viva da loja: convocações, atas, correspondência e o quadro de obreiros." system="Recebe o papel Secretário: cadastra membros, cargos, períodos e sessões; registra presença; organiza o Centro de Documentos e o inventário de materiais e patrimônio." />
                <Office name="Tesoureiro" tradition="O coração financeiro: arrecada mensalidades, paga despesas e presta contas do caixa." system="Recebe o papel Tesoureiro: emite cobranças (boleto/PIX), dá baixas, lança contas e fecha o caixa do veneralato." />
                <Office name="Chanceler" tradition="Cuida das relações externas, diplomas, certificados e correspondência com a Potência." system="Papel Secretário ou Membro; usa o Centro de Documentos e os cadastros de membros." />
                <Office name="Hospitaleiro" tradition="O cuidado fraterno: assistência a obreiros e famílias, tronco de beneficência, visitas e aniversários." system="Recebe o papel Hospitaleiro: consulta os irmãos e a família para contato, gerencia campanhas de benemerência e acompanha o saldo do Tronco de Solidariedade (ver capítulo 11)." />
                <Office name="Arquiteto" tradition="Zela pela ordem material do templo: alfaias, aventais, rituais e demais paramentos e mobiliário da loja." system="Não tem papel de acesso próprio — recebe o papel Secretário ou Administrador para usar a tela Materiais e patrimônio (ver capítulo 8)." />
              </div>
              <p className="text-sm text-sand-dark">
                A nomenclatura varia conforme o rito; sua loja já nasce com os cargos corretos e pode editá-los em
                <UI>Cargos</UI>. O vínculo cargo × período fica em <UI>Veneralato</UI>.
              </p>
            </Chapter>

            {/* ============== 6. ADMINISTRADOR ============== */}
            <Chapter id="admin" num="6" title="Guia do Administrador">
              <p>O Administrador prepara a loja para operar: dados, integrações, usuários, permissões e assinatura.</p>

              <Sub id="admin-loja" title="6.1 Configurações da loja">
                <p>Acesse <UI>Administração → Configurações da loja</UI> e preencha:</p>
                <Bullets>
                  <li><strong>Identificação:</strong> nome, razão social, nome fantasia, CNPJ, contato, endereço (o CEP preenche o endereço) e o <UI>Brasão da loja</UI> (imagem — envie em <UI>Enviar imagem</UI>).</li>
                  <li><strong>Dados bancários</strong> e <strong>chave PIX</strong> (úteis para conferência e conciliação).</li>
                  <li><strong>Loja maçônica:</strong> o <UI>Rito</UI> praticado, a <UI>Potência</UI> (obediência) e a <UI>Data de fundação</UI>. O rito define os cargos da loja; a data de fundação, se preenchida, dispara uma mensagem comemorativa automática a todos os obreiros ativos no aniversário (ver 6.6).</li>
                  <li><strong>Sessões:</strong> marque os <UI>dias da semana</UI> e a <UI>periodicidade</UI> (semanal, quinzenal ou mensal) das sessões.</li>
                </Bullets>
                <p>
                  Se trocar o rito, clique em <UI>Aplicar cargos deste rito</UI> para incluir os cargos correspondentes
                  (a ação só adiciona o que falta — não remove os cargos existentes).
                </p>
                <Note>Mantenha o CNPJ e os dados bancários corretos: eles aparecem em relatórios e ajudam na conciliação financeira.</Note>
                <p>
                  <strong>Brasão da loja:</strong> depois de enviado, aparece automaticamente em todo documento gerado
                  pela loja — relatório de Fechamento, recibo de pagamento, relatório de membros, extrato do obreiro —
                  e no cabeçalho dos e-mails automáticos (aniversários, jubileus, cobranças, convocações). Use
                  <UI> Trocar imagem</UI> para substituir ou <UI>Remover</UI> para tirar o brasão de tudo isso.
                </p>
                <p>
                  <strong>Aparência:</strong> na própria página de Configurações há a seção <UI>Aparência</UI>, onde você
                  escolhe o tema <strong>Escuro</strong> (padrão), <strong>Papiro</strong> (pergaminho suave) ou
                  <strong> Sistema</strong> (segue o modo claro/escuro do seu computador). A preferência fica salva neste
                  navegador e vale para as telas do painel — o site público continua sempre no escuro da marca.
                </p>
              </Sub>

              <Sub id="admin-asaas" title="6.2 Conectar o Asaas (cobrança aos membros)">
                <p>
                  O Asaas é o gateway que emite <strong>boleto e PIX</strong> para os membros. No modelo do Sigma Horus,
                  <strong> cada loja conecta a própria conta Asaas</strong> — o dinheiro cai direto na conta bancária da
                  loja; a plataforma nunca toca no dinheiro. Veja o passo a passo completo.
                </p>
                <p><strong>Parte A — Criar a conta e gerar a chave no Asaas:</strong></p>
                <Steps>
                  <li>Crie uma conta no Asaas. Para testes use o ambiente <strong>Sandbox</strong> (<code>sandbox.asaas.com</code>); para valer, a conta de <strong>Produção</strong> (<code>asaas.com</code>), que exige validação cadastral da loja.</li>
                  <li>No painel do Asaas, abra <strong>Minha Conta → Integrações → Chave de API</strong>.</li>
                  <li>Clique em <strong>Gerar chave de API</strong> e <strong>copie</strong> a chave (ela começa com <code>$aact_</code>). Guarde com segurança — o Asaas só a mostra uma vez.</li>
                </Steps>
                <p><strong>Parte B — Inserir a chave no Sigma Horus:</strong></p>
                <Steps>
                  <li>No Sigma Horus, vá em <UI>Administração → Integrações</UI>.</li>
                  <li>No cartão <strong>Asaas</strong>, cole a chave no campo <UI>Chave da API do Asaas</UI>.</li>
                  <li>Em <UI>Ambiente</UI>, escolha <strong>Sandbox (testes)</strong> ou <strong>Produção</strong> — o mesmo da chave que você gerou.</li>
                  <li>(Recomendado) Defina um <UI>Token do webhook</UI> — um texto secreto de sua escolha.</li>
                  <li>Clique em <UI>Conectar Asaas</UI>. Se a chave for válida, o status muda para <strong>Conectado</strong> e mostra o ambiente e a chave mascarada.</li>
                </Steps>
                <p><strong>Parte C — Configurar a baixa automática (webhook) no Asaas:</strong></p>
                <Steps>
                  <li>Ainda em <UI>Integrações</UI>, copie a <strong>URL do webhook</strong> exibida no cartão do Asaas.</li>
                  <li>No painel do Asaas, em <strong>Integrações → Webhooks (Notificações)</strong>, cadastre essa URL e ative os eventos de <strong>cobrança/pagamento</strong>.</li>
                  <li>No campo de autenticação do webhook do Asaas, informe o <strong>mesmo token</strong> do passo B (cabeçalho <code>asaas-access-token</code>).</li>
                </Steps>
                <Note>
                  Com o webhook configurado, quando o membro pagar, a cobrança é <strong>baixada automaticamente</strong> no
                  Sigma Horus — sem lançamento manual. Para trocar a chave, cole uma nova e clique em <UI>Atualizar chave</UI>;
                  para encerrar, use <UI>Desconectar</UI>.
                </Note>
              </Sub>

              <Sub id="admin-usuarios" title="6.3 Acesso dos obreiros e gestão de usuários">
                <p>
                  Todo obreiro pode ter acesso ao sistema a partir do <strong>próprio cadastro de membro</strong>. O
                  login é o <strong>e-mail cadastrado</strong> e a senha inicial é <strong>gerada pelo sistema</strong>.
                </p>
                <Steps>
                  <li>Em <UI>Secretaria → Membros & Cadastros → Membros</UI>, confirme que o membro tem <strong>e-mail</strong> e abra o cadastro.</li>
                  <li>Clique em <UI>Conceder acesso</UI>. O sistema cria o login e <strong>envia a senha provisória por e-mail</strong> ao obreiro.</li>
                  <li>No primeiro acesso, o obreiro é obrigado a <strong>definir uma nova senha</strong>.</li>
                  <li>Se precisar, use <UI>Reenviar acesso</UI> para gerar outra senha provisória.</li>
                </Steps>
                <p>
                  Em <UI>Administração → Usuários &amp; acessos</UI> o Administrador define o <strong>papel (cargo de
                  permissão)</strong> de cada usuário — Administrador, Venerável, Tesoureiro, Secretário, Hospitaleiro ou
                  Membro —, reenvia senha e ativa/desativa logins.
                </p>
                <Note>
                  Quem faz o quê: <strong>só o Administrador</strong> define papéis e concede acesso. O <strong>obreiro</strong>
                  edita o próprio cadastro (contato, endereço, família) e troca a própria senha, mas <strong>nunca</strong> o
                  próprio papel. Conceda sempre o <strong>menor privilégio necessário</strong>. A loja precisa de ao menos um
                  Administrador (o sistema impede remover o último).
                </Note>
              </Sub>

              <Sub id="admin-permissoes" title="6.4 Permissões (matriz por papel)">
                <p>
                  Em <UI>Administração → Configurações da loja → Permissões</UI> você ajusta a matriz <strong>papel ×
                  recurso × ação</strong> (ex.: quem pode ler/escrever em membros, documentos, mensagens, contas e
                  portal). A loja parte de uma configuração padrão e pode personalizá-la.
                </p>
              </Sub>

              <Sub id="admin-assinatura" title="6.5 Assinatura da plataforma">
                <p>
                  Em <UI>Administração → Assinatura</UI> você escolhe e gerencia o plano que a loja paga ao Sigma Horus.
                  Veja os detalhes de planos e regras no capítulo 12. Resumo: <strong>teste de 10 dias</strong>, depois
                  Oficina, Loja ou Potência; no <strong>anual há desconto (10% no cartão, 5% no boleto)</strong>.
                </p>
              </Sub>

              <Sub id="admin-comunicacao" title="6.6 Comunicação (WhatsApp, SMS e e-mail)">
                <p>
                  O Sigma Horus envia avisos aos irmãos (felicitações de aniversário, jubileus, lembretes de cobrança e
                  convocações de campanha). O <strong>e-mail é provido pela plataforma</strong> — já funciona, sem
                  configuração. Já <strong>WhatsApp e SMS são conectados pela própria loja</strong> (o custo das mensagens
                  é direto da loja), em <UI>Administração → Integrações</UI>, no cartão <UI>Comunicação (WhatsApp / SMS)</UI>.
                </p>
                <p>
                  Cada categoria de mensagem automática (aniversários, jubileus, lembretes de cobrança, aniversário
                  de fundação da loja) liga/desliga independente em <UI>Configurações da loja → Mensagens
                  automáticas</UI>. Jubileu cobre iniciação, elevação e exaltação (tempo de mestre) nos marcos de 1,
                  5, 10, 15, 20, 25, 30, 40, 50 e 60 anos. <strong>Aniversário de fundação</strong> exige a
                  <UI> Data de fundação</UI> preenchida em 6.1 — no dia, todos os obreiros ativos recebem uma
                  mensagem comemorativa. Membro ou familiar marcado como <strong>falecido</strong> (cadastro do
                  membro, seção Família e dependentes — ver capítulo 8) nunca recebe felicitação, mesmo com a
                  categoria ligada.
                </p>
                <p><strong>WhatsApp (Meta Cloud API):</strong></p>
                <Steps>
                  <li>Crie um app no <strong>Meta for Developers</strong> com o produto WhatsApp e obtenha o <strong>Phone Number ID</strong> e um <strong>token</strong> (de preferência permanente, via Usuário do Sistema).</li>
                  <li>Crie e aprove um <strong>template</strong> de mensagem (categoria Utilidade, idioma pt_BR, corpo com 1 variável, ex.: <code>Loja Maçônica: {'{{1}}'}</code>) — mensagens proativas exigem template aprovado.</li>
                  <li>Em Integrações, preencha <UI>Phone Number ID</UI>, <UI>Token</UI>, <UI>Nome do template</UI> e o idioma, e clique em <UI>Conectar WhatsApp</UI>.</li>
                </Steps>
                <p><strong>SMS (Twilio):</strong> informe <UI>Account SID</UI>, <UI>Auth Token</UI> e o <UI>número remetente</UI>, e clique em <UI>Conectar SMS</UI>.</p>
                <Note>
                  Enquanto um canal não estiver conectado, as mensagens daquele canal ficam <strong>registradas e
                  enfileiradas</strong> (aparecem no histórico de Comunicação) e saem assim que a loja conectar a conta.
                  As credenciais são guardadas <strong>criptografadas</strong> e isoladas por loja.
                </Note>
              </Sub>

              <Sub id="admin-importar" title="6.7 Importar cadastro de outro sistema">
                <p>
                  Se sua loja está migrando de outro sistema, é possível trazer o cadastro dos membros (e da família de
                  cada um) de uma só vez, em vez de digitar obreiro por obreiro. Fica em <UI>Administração → Importar
                  cadastros</UI>.
                </p>
                <Note>
                  Pode ser usada <strong>mais de uma vez</strong> — inclusive com a loja já tendo membros cadastrados.
                  Nesse caso, antes de gravar qualquer coisa, o sistema compara cada linha do arquivo com o cadastro
                  atual <strong>pelo CPF</strong>: quem já está cadastrado nunca é duplicado nem sobrescrito.
                </Note>
                <Steps>
                  <li>Aceita arquivos <strong>CSV</strong> ou <strong>Excel (.xlsx)</strong> exportados do seu sistema
                    atual. Para garantir 100% de compatibilidade, clique em <UI>Baixar modelo CSV</UI> e preencha nele.</li>
                  <li>Escolha o arquivo em <UI>Selecionar arquivo</UI>. O sistema lê as colunas e tenta reconhecer
                    automaticamente qual campo do Sigma Horus cada uma representa (nome, e-mail, CPF, datas maçônicas,
                    endereço, rito, potência etc.), mostrando um <strong>percentual de compatibilidade</strong>.</li>
                  <li>Revise o <UI>Mapeamento das colunas</UI>: para cada coluna do arquivo há um seletor mostrando a que
                    campo ela foi associada — corrija manualmente qualquer coluna que tenha sido reconhecida errado, ou
                    marque <UI>Ignorar esta coluna</UI> quando não se aplicar.</li>
                  <li>Se a loja já tiver membros, confira o card <UI>Comparação com o cadastro atual</UI>: ele mostra
                    quantas linhas são <strong>novas</strong> (entram automaticamente), quantas <strong>já existem</strong>
                    (mesmo CPF de um membro já cadastrado — ficam de fora, nunca são tocadas) e quantas ficaram
                    <strong> sem CPF para confirmar</strong>. Para essas últimas o sistema não arrisca um palpite sozinho:
                    marque, uma a uma, só as linhas que você confirmou serem pessoas realmente novas — as que ficarem
                    sem marcar não entram nesta importação.</li>
                  <li>Confira os <UI>Pontos para revisar</UI>: linhas com CPF inválido, grau filosófico fora do
                    intervalo 4–33 ou data não reconhecida ainda são importadas (o dado problemático fica em branco ou
                    marcado para revisão manual depois); só a linha <strong>sem nome</strong> é descartada, já que o
                    nome é o único campo obrigatório.</li>
                  <li>Clique em <UI>Confirmar importação</UI>. Ao final, o resumo mostra quantos membros entraram,
                    quantos já existiam (ignorados), quantos ficaram pendentes sem confirmação, quantas linhas foram
                    ignoradas e quantos avisos restaram para conferência manual.</li>
                </Steps>
                <p>
                  Se o arquivo tiver colunas para cônjuge, pai, mãe ou filhos, o sistema já organiza esses dados como
                  <strong> família e dependentes</strong> de cada membro automaticamente — o mesmo cadastro usado no
                  detalhe do obreiro. Ritos e potências informados por nome são associados aos já cadastrados na loja;
                  se um rito ou potência não for encontrado, o campo fica em branco para preenchimento manual depois.
                </p>
                <Note>
                  Se nenhuma coluna do arquivo puder ser reconhecida como o <strong>nome</strong> do membro, a importação
                  é <strong>interrompida</strong> antes de qualquer gravação, e o sistema pede um arquivo diferente — nada
                  é criado pela metade. E sem CPF preenchido em nenhum dos lados (arquivo e cadastro atual), o sistema
                  também nunca arrisca um palpite por nome — prefere pedir sua confirmação a duplicar ou perder alguém.
                </Note>
              </Sub>

              <Sub id="admin-backup" title="6.8 Backup dos dados da loja">
                <p>
                  Em <UI>Administração → Configurações da loja</UI>, o botão <UI>Baixar backup completo da minha
                  loja</UI> gera na hora um arquivo com todos os dados da sua loja — cadastro dos membros e família,
                  financeiro, sessões, documentos, plano de contas, cargos e histórico de auditoria — e baixa direto
                  pro seu computador (pasta padrão de downloads do navegador), com o nome da loja no arquivo.
                </p>
                <Note>
                  Esse arquivo é seu — guarde-o num lugar seguro (ex.: nuvem própria, pen drive). Ele não inclui senhas
                  nem chaves de integração (Asaas, WhatsApp, SMS), que ficam só no servidor. Além desse backup sob
                  demanda, a plataforma também mantém um backup automático diário e criptografado de toda a base, para
                  recuperação em caso de problema grave com a infraestrutura (capítulo 14).
                </Note>
              </Sub>
            </Chapter>

            {/* ============== 7. TESOUREIRO ============== */}
            <Chapter id="tesoureiro" num="7" title="Guia do Tesoureiro">
              <p>
                Este é o coração do sistema. A seguir, o passo a passo de tudo que o Tesoureiro faz, na ordem natural de
                uso: organizar o plano de contas, lançar contas, cobrar os membros, dar baixas e prestar contas.
              </p>

              <Sub id="tes-plano" title="7.1 Plano de contas (livro caixa)">
                <p>
                  O plano de contas classifica receitas e despesas no formato de <strong>livro caixa</strong>, com
                  codificação hierárquica (grupo.subgrupo.conta) — por exemplo <code>1.1.01 Mensalidades</code>,
                  <code>2.1.05 Concessão/Aluguel</code>, <code>8.9.03 Ação Social e Caridade</code>. O código serve de
                  base para a totalização por grupo no balancete e no fechamento.
                </p>
                <p>
                  Consulte e ajuste em <UI>Cadastros financeiros → Plano de contas</UI>. Para completar com o modelo
                  padrão, use <UI>Popular dados padrão (Brasil)</UI> em <UI>Cadastros mestre</UI> (também preenche ritos
                  e potências; adiciona apenas os códigos que faltam, sem duplicar). Para retirar uma conta que não usa,
                  clique em <UI>Remover</UI> ao lado dela.
                </p>
                <p>
                  Se a sua loja foi criada com uma versão antiga do plano (códigos como <code>1.01</code> em vez de
                  <code> 1.1.01</code>), clique em <UI>Atualizar plano de contas</UI> para migrar ao padrão atual: ele
                  adiciona as contas que faltam e remove as contas padrão antigas <strong>que não estão em uso</strong>
                  (as contas vinculadas a lançamentos são preservadas). Isso também habilita o <strong>Tronco de
                  Solidariedade</strong> usado pela Hospitalaria (capítulo 11).
                </p>
              </Sub>

              <Sub id="tes-contas" title="7.2 Lançar contas a receber e a pagar">
                <p>Em <UI>Tesouraria → Entradas e Saídas → Contas</UI>, no bloco <UI>Nova conta</UI>:</p>
                <Steps>
                  <li>Escolha a <UI>Categoria (plano de contas)</UI> — ela já sugere o título e o tipo.</li>
                  <li>Confira o <UI>Título da conta</UI> e o tipo: <strong>Conta a receber</strong> ou <strong>Conta a pagar</strong>.</li>
                  <li>Informe o <UI>Valor</UI> e a <UI>Data</UI> de vencimento.</li>
                  <li>Defina o <UI>Status</UI> (Pendente, Pago ou Vencido).</li>
                  <li>Opcional: <UI>Vincular a um membro</UI> ou <UI>Vincular a um cliente/fornecedor</UI> (cadastro de quem não é membro — ver 7.13), escolher a <UI>Conta bancária/caixa prevista</UI> (ver 7.14) e escrever uma <UI>Descrição</UI>.</li>
                  <li>Clique em <UI>Salvar conta</UI>. A conta aparece na lista <UI>Contas cadastradas</UI>; use <UI>Remover</UI> para excluir.</li>
                </Steps>
                <Bullets>
                  <li><strong>Editar:</strong> clique em <UI>Editar</UI> na linha da conta para corrigir valor, vencimento, título ou vínculo — não precisa excluir e recriar. Contas de um veneralato já encerrado não podem ser editadas nem excluídas.</li>
                  <li><strong>Buscar:</strong> o campo de busca acima da lista filtra por título, membro ou status.</li>
                  <li><strong>É mensalidade do membro:</strong> ao vincular a conta a um membro, aparece essa opção — marque para que ela entre na regra de inadimplência do Art. 002 (capítulo 7.8).</li>
                </Bullets>
              </Sub>

              <Sub id="tes-cobrancas" title="7.3 Criar cobranças e recorrência">
                <p>
                  Cobranças são os títulos que você gera para receber dos membros. Em <UI>Tesouraria → Entradas e Saídas → Cobranças</UI>, no
                  bloco <UI>Nova cobrança</UI>:
                </p>
                <Steps>
                  <li>Selecione a <UI>categoria</UI> da cobrança (centro de custo do plano de contas: Mensalidades, Taxa de Iniciação, Taxa de Elevação, Taxa de Exaltação, eventos etc.). O <strong>lançamento a receber é criado automaticamente junto com a cobrança</strong>. O Tronco de Solidariedade não aparece aqui — a doação tem fluxo próprio na Hospitalaria.</li>
                  <li>Selecione o <UI>membro</UI> a cobrar (obrigatório; necessário para emitir boleto/PIX depois, ver 7.4).</li>
                  <li>Informe o <UI>Valor</UI> e a <UI>Data</UI> de vencimento. O <UI>Número / referência</UI> é <strong>gerado automaticamente</strong> (formato <code>COB-AAAAMM-NNNN</code>) se você deixar o campo em branco.</li>
                  <li>Opcional: <UI>Descrição</UI>.</li>
                  <li>Para mensalidades, marque <UI>Criar como cobrança recorrente</UI> e defina o intervalo (<strong>Mensal</strong>, <strong>Trimestral</strong> ou <strong>Anual</strong>) e a <UI>quantidade de ocorrências</UI>.</li>
                  <li>Clique em <UI>Criar cobrança</UI>.</li>
                </Steps>
                <p>
                  Para gerar as parcelas recorrentes que já venceram/estão previstas, use o botão <UI>Processar
                  recorrentes</UI> no bloco <UI>Recorrência</UI> — ele cria as cobranças do período automaticamente.
                </p>
                <p>
                  <strong>Cobrança em massa:</strong> para cobrar todos os irmãos de uma vez (ex.: mensalidade), use o
                  bloco <UI>Cobrança em massa</UI> — escolha a categoria, o público (membros ativos ou todos), o valor por
                  membro e o vencimento, e clique em <UI>Gerar para todos os membros</UI>. Cria, para cada membro, o lançamento a receber e uma cobrança numerada
                  automaticamente (e, se marcado, recorrente). Na categoria Mensalidades, membros isentos (Maçom Remido) ficam de fora.
                </p>
                <p>
                  Na lista <UI>Cobranças cadastradas</UI>, cada item mostra um status: <strong>Pendente</strong>,
                  <strong> Emitida</strong>, <strong>Paga</strong> ou <strong>Vencida</strong>. Use o campo de busca para
                  filtrar por número, membro ou status.
                </p>
                <Bullets>
                  <li><strong>Lembrar:</strong> envia por e-mail um lembrete avulso da cobrança ao membro — útil pra cobrar na hora, além do lembrete automático que o sistema já envia 3 dias antes do vencimento.</li>
                  <li><strong>Cancelar:</strong> remove a cobrança e o lançamento a receber gerado por ela (nunca mexe em pagamentos já registrados). Só funciona em cobranças ainda não pagas.</li>
                </Bullets>
              </Sub>

              <Sub id="tes-asaas" title="7.4 Emitir boleto/PIX no Asaas">
                <p>Pré-requisitos: o Administrador já conectou o Asaas (6.2) e a cobrança está vinculada a um membro com <strong>CPF cadastrado</strong>.</p>
                <Steps>
                  <li>Confirme que o membro tem <strong>CPF</strong> preenchido em <UI>Membros</UI> (sem CPF o Asaas recusa).</li>
                  <li>Em <UI>Cobranças</UI>, localize a cobrança e clique em <UI>Emitir no Asaas</UI>.</li>
                  <li>O sistema cria o cliente do membro no Asaas, gera a cobrança (boleto/PIX) e devolve o link <UI>Abrir cobrança</UI> para enviar ao membro.</li>
                  <li>O status passa a <strong>Emitida</strong>. Se precisar refazer, use <UI>Reemitir</UI>.</li>
                </Steps>
                <Note>Quando o membro pagar, o webhook do Asaas (6.2-C) <strong>baixa a cobrança automaticamente</strong> e registra o pagamento — você não precisa lançar nada à mão.</Note>
              </Sub>

              <Sub id="tes-pagamentos" title="7.5 Registrar pagamentos (baixa manual)">
                <p>
                  Para pagamentos recebidos fora do Asaas (dinheiro, PIX direto, etc.) ou para baixar contas a pagar, use
                  <UI>Tesouraria → Entradas e Saídas → Pagamentos</UI>, bloco <UI>Novo pagamento</UI>:
                </p>
                <Steps>
                  <li>Selecione a <UI>conta</UI> correspondente e, se quiser, <UI>vincule a um membro</UI>.</li>
                  <li>Informe o <UI>Valor</UI> e a <UI>Data</UI> do pagamento.</li>
                  <li>Escolha o <UI>método</UI>: Manual, PIX, Dinheiro ou Cartão.</li>
                  <li>Escolha a <UI>Conta bancária/caixa que recebeu ou pagou</UI> — obrigatório em todo pagamento novo,
                    para saber exatamente onde o dinheiro entrou ou saiu (ver 7.14). Se a conta a receber/pagar já tinha
                    uma <UI>conta bancária prevista</UI> (7.2), o campo já vem preenchido sozinho; pode trocar se o
                    dinheiro foi de fato para outro lugar.</li>
                  <li>Opcional: <UI>Observação</UI>.</li>
                  <li>Marque a <strong>declaração de ciência</strong> (confirma a veracidade e o aceite dos Termos) — obrigatória.</li>
                  <li>Clique em <UI>Registrar pagamento</UI>. Ele aparece em <UI>Pagamentos recentes</UI>.</li>
                </Steps>
                <Bullets>
                  <li><strong>Recibo:</strong> cada pagamento tem um link <UI>Recibo</UI> — abre um comprovante pronto pra <UI>Salvar como PDF</UI> pelo diálogo de impressão do navegador.</li>
                  <li><strong>Estornar:</strong> lançou errado? Clique em <UI>Estornar</UI> na linha do pagamento — ele é removido e o status da conta/cobrança volta ao que era antes. Não funciona dentro de um período já encerrado.</li>
                  <li>Quando a conta é a receber (não a pagar), o membro recebe automaticamente um <strong>e-mail de confirmação</strong> do pagamento.</li>
                </Bullets>
              </Sub>

              <Sub id="tes-relatorios" title="7.6 Relatórios e fechamento">
                <p>
                  Em <UI>Tesouraria → Relatórios → Resumo financeiro</UI> você acompanha <UI>Resumo de abertura</UI>,
                  <UI> Próximos vencimentos</UI> e <UI>Últimos registros</UI>, com <strong>filtro por período</strong> e <UI>Exportar</UI> (CSV).
                </p>
                <p>
                  Em <UI>Tesouraria → Relatórios → Fechamento</UI> está o <strong>relatório financeiro completo</strong> no formato livro
                  caixa, para o fechamento do veneralato: <strong>Balanço Financeiro</strong>, <strong>Balancete por plano
                  de contas</strong>, <strong>Receitas × Despesas</strong> mensal, <strong>Livro Caixa</strong>,
                  <strong> Cobranças</strong> e <strong>Saldo dos Irmãos</strong>. Escolha o período e use
                  <UI>Salvar como PDF</UI> para gerar o documento. As contas são agrupadas pelo plano de contas (código),
                  então vincule cada lançamento a uma <strong>categoria do plano de contas</strong> para o relatório sair correto.
                </p>
              </Sub>

              <Sub id="tes-fechamento" title="7.7 Encerramento do veneralato (3 passos)">
                <p>
                  Ao fim da gestão, em <UI>Secretaria → Veneralato & Sessões → Veneralato</UI> o encerramento segue <strong>três passos
                  encadeados</strong>, cada um com um responsável — não se pula etapa:
                </p>
                <Steps>
                  <li><strong>1. Fechamento de caixa (Tesoureiro):</strong> abra o período e clique em <UI>Fechar caixa deste período</UI>. O sistema registra o snapshot — saldo de abertura (herdado), entradas, saídas e <strong>saldo final</strong>.</li>
                  <li><strong>2. Prestação de contas (Venerável):</strong> o Venerável revisa e clica em <UI>Aprovar prestação de contas</UI>.</li>
                  <li><strong>3. Encerrar veneralato (Administrador):</strong> só fica disponível <em>após</em> a aprovação. Ao encerrar, os lançamentos do período ficam <strong>travados</strong> e o saldo final é <strong>herdado pela próxima gestão</strong> como saldo de abertura.</li>
                </Steps>
                <Note>
                  Depois de encerrado, nenhum lançamento (conta ou pagamento) pode ter data dentro do período fechado — o
                  sistema bloqueia para preservar a prestação de contas aprovada. Ao criar o <strong>novo veneralato</strong>, o
                  livro caixa já abre com o saldo herdado do período anterior.
                </Note>
              </Sub>

              <Sub id="tes-inadimplencia" title="7.8 Inadimplência, Art. 002 e renegociação">
                <p>
                  O Art. 002 é a sanção regimental de <strong>suspensão dos direitos maçônicos</strong> do membro
                  inadimplente com a mensalidade há mais de <strong>60 dias</strong>. O Sigma Horus acompanha isso
                  automaticamente, com base no regimento interno da loja.
                </p>
                <Steps>
                  <li>
                    Ao lançar uma conta a receber vinculada a um membro em <UI>Tesouraria → Entradas e Saídas → Contas</UI>, marque a
                    caixa <strong>&quot;É mensalidade do membro&quot;</strong>. Só contas marcadas assim entram na
                    regra dos 60 dias — cobranças pontuais (evento, campanha) não contam.
                  </li>
                  <li>
                    Em <UI>Tesouraria → Relatórios → Inadimplência (Art. 002)</UI>, veja todos os membros com
                    mensalidade em aberto: quantidade de parcelas, valor total, vencimento mais antigo, dias de
                    atraso e, se configurada (7.9), a <strong>multa/juros estimados</strong>. Os enquadrados no
                    Art. 002 aparecem destacados.
                  </li>
                  <li>
                    O critério é o <strong>vencimento em aberto mais antigo</strong>: se ele já passou de 60 dias, o
                    membro está enquadrado, mesmo que parcelas mais recentes tenham sido pagas fora de ordem.
                  </li>
                  <li>
                    Acima da lista, os cartões de <UI>Faixas de atraso</UI> agrupam os membros por tempo de atraso
                    (1-30, 31-60, 61-90 e mais de 90 dias) — clique numa faixa pra filtrar a lista só com aquele grupo,
                    útil pra priorizar quem cobrar primeiro.
                  </li>
                </Steps>
                <Note>
                  A situação do membro é atualizada <strong>automaticamente</strong>: ao cruzar 60 dias, o cadastro
                  passa para &quot;Art. 002&quot;; quando a pendência é paga ou excluída, volta para &quot;Ativo&quot;
                  sozinho — não é preciso alterar o cadastro manualmente. Enquanto durar, o próprio membro recebe um
                  aviso no painel pedindo para procurar o Tesoureiro ou o Venerável Mestre (capítulo 10).
                </Note>
                <p>
                  <strong>Desligar o enquadramento automático:</strong> em <UI>Configurações → Financeiro</UI>
                  (Administrador), desmarque <UI>Aplicar automaticamente o Art. 002</UI> se a sua loja preferir tratar
                  a suspensão manualmente (ex.: decisão em sessão, caso a caso) em vez de deixar o sistema mudar a
                  situação do obreiro sozinho.
                </p>
                <Note>
                  Desligar esse ajuste <strong>não some com nada</strong>: o relatório de Inadimplência continua
                  mostrando todo mundo em atraso normalmente, e quem já está em &quot;Art. 002&quot; ainda volta para
                  &quot;Ativo&quot; sozinho assim que a pendência for paga. O que muda é só que, com o ajuste
                  desligado, ninguém <strong>novo</strong> é promovido a &quot;Art. 002&quot; automaticamente, e o
                  membro em atraso não recebe mais o aviso no painel — a decisão de afastar fica manual, pelo
                  cadastro do membro. O padrão de fábrica é <strong>ligado</strong>, preservando o comportamento
                  automático de sempre.
                </Note>
                <p>
                  <strong>Renegociar a dívida:</strong> no próprio relatório de Inadimplência, clique em <UI>Negociar</UI>
                  na linha do membro. Escolha a data do <strong>1º vencimento</strong> e, se quiser, marque
                  <UI> Incluir multa/juros no total</UI>. O sistema soma as mensalidades vencidas (mais o encargo, se
                  marcado) e redistribui em novas parcelas mensais, reaproveitando as mesmas contas — o Art. 002 deixa
                  de contar assim que os vencimentos passam a ser no futuro.
                </p>
                <p>
                  <strong>Maçom Remido:</strong> membros isentos de mensalidade (cadastro em <UI>Membros → Evolução
                  maçônica</UI>, marcando <UI>Isento de mensalidade</UI> — o sistema mostra se ele é elegível pelos
                  critérios usuais: 65 anos + 15 de Mestre, ou 25 anos de Ordem) nunca entram na regra do Art. 002 nem
                  na cobrança em massa de mensalidade.
                </p>
              </Sub>

              <Sub id="tes-aprovacao" title="7.9 Aprovação de despesas e multa/juros de mora">
                <p>
                  Em <UI>Configurações → Financeiro</UI> (Administrador), três ajustes opcionais:
                </p>
                <Bullets>
                  <li><strong>Limite para aprovação de despesa:</strong> contas a pagar com valor igual ou acima desse limite nascem &quot;aguardando aprovação&quot; — só o Venerável Mestre ou o Administrador podem liberar (botão <UI>Aprovar</UI> em Contas), e só depois disso o Tesoureiro consegue registrar o pagamento. Deixe em branco para não exigir aprovação de nada.</li>
                  <li><strong>Multa por atraso (%)</strong> e <strong>Juros de mora ao mês (%)</strong>: informativos — aparecem no relatório de Inadimplência e na renegociação de dívida, mas não alteram sozinhos o valor das contas já lançadas.</li>
                </Bullets>
              </Sub>

              <Sub id="tes-balancetes" title="7.10 Balancetes periódicos">
                <p>
                  Em <UI>Tesouraria → Relatórios → Balancetes periódicos</UI>, gere o balancete de qualquer intervalo de
                  datas (trimestral, semestral — o que o regulamento da sua Potência exigir), independente do
                  encerramento do veneralato inteiro. Escolha <UI>De</UI>/<UI>Até</UI>, clique em <UI>Gerar
                  balancete</UI> e, depois de apresentado em sessão, o Venerável ou o Administrador clica em
                  <UI> Aprovar</UI> para registrar.
                </p>
                <p>
                  <strong>Acesso rápido:</strong> no topo da página, três botões — <UI>Bimestral</UI>,
                  <UI> Trimestral</UI> e <UI>Semestral</UI> — geram de um clique o balancete do último período já
                  fechado do <strong>veneralato em exercício</strong>, contando em blocos de 2/3/6 meses a partir da
                  data de início desse veneralato (não do calendário civil). Abaixo de cada botão aparece o intervalo
                  que ele vai gerar.
                </p>
                <Note>
                  Um botão fica <strong>sem ação</strong> enquanto o veneralato ainda não tiver completado aquele
                  bloco de meses — um período que termina justamente hoje ainda não conta como fechado, só a partir de
                  amanhã. Por exemplo, veneralato iniciado em 01/07: em 31/08 nenhum dos três botões funciona ainda
                  (o próprio bimestre só fecha nessa data); já em 31/12 o Bimestral e o Trimestral já geram o período
                  mais recente completo, mas o Semestral continua sem ação até 01/01, pois o semestre inteiro só se
                  completa em 31/12. Enquanto isso, o botão mostra <UI>Disponível a partir de</UI> e a data em que
                  destrava. Sem veneralato em exercício, os três ficam ocultos.
                </Note>
                <Note>
                  Em <UI>Configurações → Financeiro</UI>, marque <UI>Emitir balancete mensal automaticamente</UI> para
                  o sistema gerar sozinho, todo dia 1º, o balancete do mês anterior — sem precisar lembrar de gerar
                  manualmente.
                </Note>
              </Sub>

              <Sub id="tes-gerencial" title="7.11 Fluxo de caixa, orçamento e patrimônio">
                <p>
                  Três telas de visão gerencial, em <UI>Tesouraria</UI>:
                </p>
                <Bullets>
                  <li><strong>Fluxo de caixa projetado:</strong> mostra o que já está lançado e ainda não foi pago, separado em faixas (vencido, próximos 30/60/90 dias) — ajuda a antecipar se o caixa vai apertar antes de acontecer.</li>
                  <li><strong>Orçamento anual:</strong> defina a meta de receita/despesa por categoria do plano de contas no início do ano (clique no valor <UI>Orçado</UI> pra editar) e acompanhe o <UI>Realizado</UI> junto, com barra de progresso.</li>
                  <li><strong>Patrimônio:</strong> inventário simples dos bens da loja (móveis, insígnias, equipamentos) — nome, categoria, data e valor de aquisição, valor atual estimado e vínculo opcional ao plano de contas. Não calcula depreciação sozinho.</li>
                </Bullets>
              </Sub>

              <Sub id="tes-conciliacao" title="7.12 Conciliação: Asaas e extrato bancário">
                <p>
                  Duas formas de conferir se o que está lançado no sistema bate com o dinheiro de verdade:
                </p>
                <Bullets>
                  <li><strong>Verificar pagamentos no Asaas</strong> (em <UI>Integrações</UI>, se o Asaas estiver conectado): confere no Asaas cobranças emitidas que ainda não baixaram no sistema — cobre o caso raro de o aviso automático (webhook) falhar ou atrasar.</li>
                  <li><strong>Conciliação bancária</strong> (<UI>Tesouraria → Cadastros e Conferência → Conciliação bancária</UI>): importe o extrato do seu banco (arquivo <strong>OFX</strong>, exportado pelo internet banking, ou <strong>CSV</strong> com colunas Data/Descrição/Valor). O sistema tenta casar cada linha com um pagamento já registrado (mesmo valor, data próxima, mesma direção — receber ou pagar); o que não casar sozinho fica disponível para <UI>Vincular manualmente</UI> ou <UI>Ignorar</UI>.</li>
                </Bullets>
              </Sub>

              <Sub id="tes-clientes-fornecedores" title="7.13 Clientes e fornecedores">
                <p>
                  Cadastro de quem <strong>não é membro</strong> da loja, mas aparece em contas a pagar ou a receber —
                  fornecedor de evento, buffet, entidade paramaçônica, contribuição à Grande Loja, doador avulso, etc.
                  Em <UI>Cadastros financeiros → Clientes e fornecedores</UI>:
                </p>
                <Steps>
                  <li>Clique em <UI>+ Novo cadastro</UI> e informe o <UI>Nome</UI>.</li>
                  <li>Escolha o tipo: <strong>Cliente</strong> (quem paga a loja), <strong>Fornecedor</strong> (quem a loja paga) ou <strong>Cliente e fornecedor</strong>, quando os dois casos acontecem com a mesma contraparte.</li>
                  <li>Opcional: <UI>CPF/CNPJ</UI>, <UI>Telefone</UI> e <UI>Cidade</UI>.</li>
                  <li>Ao lançar uma conta (7.2), use <UI>Vincular a um cliente/fornecedor</UI> em vez de membro — o nome passa a aparecer na lista de <UI>Contas cadastradas</UI> e nos relatórios, em vez de &ldquo;Sem vínculo&rdquo;.</li>
                </Steps>
                <p>
                  Filtre a lista por <UI>Clientes</UI> ou <UI>Fornecedores</UI> no seletor acima dela. Remover um cadastro
                  não apaga as contas já lançadas — elas mantêm o nome guardado, só perdem o vínculo com o cadastro.
                </p>
              </Sub>

              <Sub id="tes-contas-bancarias" title="7.14 Contas bancárias, Caixa e transferências">
                <p>
                  Antes do Sigma Horus separar isso, todo pagamento caía num único bolo de caixa da loja, sem registrar
                  se o dinheiro estava no banco, numa aplicação ou em espécie. Agora cada loja cadastra os
                  <strong> &quot;bolsos&quot;</strong> que usa de verdade — um ou mais bancos, uma conta de investimento,
                  o Caixa físico — e vincula cada pagamento a um deles, além de poder <strong>transferir saldo entre
                  eles</strong> com aprovação em dois passos.
                </p>
                <p><strong>Cadastrar as contas</strong> — em <UI>Cadastros financeiros → Contas bancárias e Caixa</UI>:</p>
                <Steps>
                  <li>Clique em <UI>+ Nova conta</UI> e escolha o tipo: <strong>Banco</strong> ou <strong>Caixa</strong>.</li>
                  <li>
                    Para <strong>Banco</strong>: escolha o nome na lista (os bancos mais usados no Brasil — não existe
                    uma lista &quot;só do Rio de Janeiro&quot;, pois bancos operam no país inteiro; escolha
                    <UI> Outro</UI> se o seu não estiver lá), dê um <UI>rótulo</UI> pra diferenciar contas do mesmo banco
                    (ex.: &quot;Santander CC&quot; e &quot;Santander Investimento&quot;), informe <UI>Agência</UI> e
                    <UI> Conta</UI> (opcionais) e marque <UI>Conta de investimento</UI> quando for o caso.
                  </li>
                  <li>Para <strong>Caixa</strong>: só o nome (ex.: &quot;Caixa da Loja&quot;) — representa o dinheiro em espécie guardado fisicamente.</li>
                  <li>
                    Preencha o <UI>Saldo inicial</UI> com o que já existia de verdade nessa conta/Caixa <strong>antes</strong>
                    de começar a lançar no sistema (o extrato do banco/CDB na data em que a loja começou a usar o Sigma
                    Horus, ou o dinheiro físico contado no Caixa naquele dia). Deixe em branco (zero) para uma conta nova,
                    aberta sem saldo prévio.
                  </li>
                  <li>Clique em <UI>Criar</UI>. Uma conta que já tem lançamentos não pode ser excluída — use <UI>Desativar</UI> para tirá-la das opções de novos lançamentos sem perder o histórico. O <UI>Saldo inicial</UI> pode ser corrigido depois em <UI>Editar</UI>, a qualquer momento.</li>
                </Steps>
                <Note>
                  <strong>Para o Tesoureiro:</strong> o saldo que a loja já tinha em banco/investimento/Caixa antes de
                  começar a usar o sistema entra <strong>sempre</strong> pelo campo <UI>Saldo inicial</UI> desta tela —
                  nunca lance esse valor como uma &quot;Conta a receber&quot; ou &quot;Conta a pagar&quot; fictícia só
                  pra fazer o saldo bater. Uma conta a receber falsa não é dinheiro que alguém deve à loja; ela infla o
                  card <UI>A receber</UI> do <UI>Resumo financeiro</UI> (7.6) com um valor que não tem cobrança nenhuma
                  por trás, e passa a falsa impressão de inadimplência ou de recebíveis pendentes. O jeito certo de
                  registrar &quot;o que a loja já tinha quando começou a escriturar aqui&quot; é sempre o <UI>Saldo
                  inicial</UI> da própria conta bancária/Caixa (esta seção), nunca uma conta a receber/pagar.
                </Note>
                <p>
                  <strong>Usar nos lançamentos:</strong> ao lançar uma conta a receber/pagar (7.2), a <UI>Conta bancária/
                  caixa prevista</UI> é opcional — serve só para já vir sugerida na hora de dar baixa. Ao registrar o
                  pagamento de verdade (7.5), escolher a conta é <strong>obrigatório</strong>: é isso que dá o saldo real
                  de cada banco/caixa.
                </p>
                <p>
                  <strong>Transferir entre contas</strong> — em <UI>Tesouraria → Entradas e Saídas → Transferências entre contas</UI>:
                </p>
                <Steps>
                  <li>No topo da tela, confira o <strong>saldo atual</strong> de cada conta cadastrada.</li>
                  <li>No bloco <UI>Nova transferência</UI>, escolha <UI>De (origem)</UI> e <UI>Para (destino)</UI>, o <UI>Valor</UI>, a <UI>Data</UI> e, se quiser, uma <UI>Observação</UI> — e clique em <UI>Solicitar transferência</UI>.</li>
                  <li>A transferência nasce <strong>Pendente</strong> e ainda <strong>não muda saldo nenhum</strong>.</li>
                  <li>O <strong>Venerável Mestre</strong> (ou o Administrador) revisa no <UI>Histórico</UI> e clica em <UI>Aprovar</UI> — só então o valor sai da origem e entra no destino — ou em <UI>Rejeitar</UI>, se não for o caso.</li>
                </Steps>
                <Note>
                  Essa dupla conferência (quem pede não é quem libera) existe para o mesmo cuidado de uma despesa acima
                  do limite (7.9): nenhuma movimentação de saldo entre contas acontece sem duas pessoas envolvidas. Uma
                  transferência com data dentro de um veneralato já encerrado é bloqueada, como qualquer outro lançamento (7.7).
                </Note>
              </Sub>
              <Sub id="tes-extratos" title="7.15 Extratos de contas">
                <p>
                  Em <UI>Tesouraria → Entradas e Saídas → Extratos de contas</UI>, veja a movimentação completa de uma
                  conta bancária ou do Caixa isoladamente — o mesmo espírito de um extrato bancário: saldo inicial do
                  período, cada lançamento em ordem cronológica com saldo corrente, e saldo final.
                </p>
                <Steps>
                  <li>Escolha a <UI>Conta</UI> (banco, investimento ou Caixa) e o período (<UI>De</UI>/<UI>Até</UI>), ou use um atalho: <UI>Mês atual</UI>, <UI>Mês anterior</UI>, <UI>Ano atual</UI> ou <UI>Desde a abertura</UI>.</li>
                  <li>Clique em <UI>Aplicar</UI>. A tela mostra o <UI>Saldo inicial</UI>, as <UI>Entradas</UI> e <UI>Saídas</UI> do período e o <UI>Saldo final</UI>, seguidos da tabela linha a linha.</li>
                  <li><UI>Salvar como PDF</UI> imprime o extrato com o timbre da loja (mesmo padrão do fechamento, 7.11). <UI>Baixar XLS</UI> gera uma planilha Excel de verdade com as mesmas linhas, pronta pra conferência ou arquivo.</li>
                </Steps>
                <Note>
                  O extrato só mostra o que está lançado no Sigma Horus (pagamentos e transferências aprovadas) — é o
                  livro oficial da conta, por isso o saldo final sempre bate com o saldo mostrado em <UI>Cadastros
                  financeiros</UI> e em <UI>Transferências</UI>. Para comparar contra o extrato real do banco (OFX), use
                  a <UI>Conciliação bancária</UI> (7.12) — ferramentas diferentes, propósitos diferentes.
                </Note>
              </Sub>
              <Sub id="tes-dre" title="7.16 DRE comparativo entre períodos">
                <p>
                  Em <UI>Tesouraria → Relatórios → DRE comparativo</UI>, veja receitas e despesas por conta do plano de
                  contas, comparando dois períodos lado a lado — útil pra ver se uma categoria cresceu ou caiu de um
                  mês/ano pro outro, sem precisar decorar os números do período anterior.
                </p>
                <Steps>
                  <li>Escolha o <UI>Período A</UI> (<UI>De</UI>/<UI>Até</UI>, com os atalhos <UI>Mês atual</UI>, <UI>Ano atual</UI> e, se houver um veneralato em exercício, <UI>Este veneralato</UI>).</li>
                  <li>
                    Escolha em <UI>Comparar com</UI>: <UI>Período anterior equivalente</UI> (mesma duração, logo antes
                    do período A) ou <UI>Mesmo período do ano anterior</UI> — o sistema calcula o Período B sozinho,
                    sem digitar uma segunda data.
                  </li>
                  <li>A tabela mostra, por conta do plano de contas, o valor em cada período e a <UI>Variação</UI> em R$ e %. Verde é sempre &quot;foi bom&quot; (receita subiu ou despesa caiu); vermelho é o oposto. <UI>Salvar como PDF</UI> imprime com o timbre da loja.</li>
                </Steps>
              </Sub>
            </Chapter>

            {/* ============== 8. SECRETÁRIO ============== */}
            <Chapter id="secretario" num="8" title="Guia do Secretário">
              <p>O Secretário mantém o quadro de obreiros, a estrutura de cargos, as sessões e os documentos.</p>
              <Sub id="sec-membros" title="8.1 Membros — buscar, cadastrar, editar e excluir">
                <p>
                  Em <UI>Secretaria → Membros & Cadastros → Membros</UI>, a tela abre com a <strong>lista de obreiros</strong> em formato
                  de tabela compacta. Use a <UI>busca</UI> (por <strong>nome, CPF ou CIM</strong>) e o filtro de
                  <UI> situação</UI> para encontrar rapidamente. Clique numa linha para <strong>expandir</strong> os detalhes,
                  onde ficam os botões <UI>Editar</UI> e <UI>Excluir cadastro</UI>.
                </p>
                <p>
                  Com um membro já cadastrado expandido (em modo de visualização ou já em <UI>Editar</UI>), o
                  Secretário, o Venerável ou o Administrador podem enviar a <UI>Foto</UI> do irmão (<UI>Enviar
                  foto</UI>/<UI>Trocar foto</UI>/<UI>Remover</UI>) — o botão fica logo acima dos dados do membro,
                  independente do modo. Essa foto alimenta automaticamente a
                  <Link className="text-gold hover:text-gold-light" href="#sec-galeria-veneraveis"> Galeria de Veneráveis</Link> (quando o
                  irmão serviu como Venerável Mestre) e o <Link className="text-gold hover:text-gold-light" href="#sec-quadro-gestao">Quadro da Gestão</Link> do período em exercício.
                </p>
                <Steps>
                  <li>Clique em <UI>+ Novo membro</UI>. Só o <strong>nome</strong> é obrigatório; os demais blocos abrem conforme a necessidade.</li>
                  <li><strong>Essencial:</strong> nome, e-mail, telefone, situação, rito e potência atual.</li>
                  <li><strong>Dados pessoais:</strong> nascimento, <strong>CPF</strong>, RG, estado civil, profissão e nacionalidade.</li>
                  <li><strong>Família e dependentes:</strong> Mãe, Pai e Esposa (com nascimento, e-mail e telefone) e a lista de dependentes (Filho/Filha/Outro, com CPF e contatos). Esses contatos servem às felicitações da Hospitalaria. Marque <UI>Falecido(a)</UI> em quem já não estiver entre nós — a pessoa some das felicitações de aniversário automáticas, sem apagar o cadastro.</li>
                  <li><strong>Endereço:</strong> o <UI>CEP</UI> preenche o endereço automaticamente.</li>
                  <li><strong>Evolução maçônica:</strong> os marcos <strong>Iniciação, Elevação, Exaltação e Instalação</strong> (data + loja de cada um).</li>
                  <li>Clique em <UI>Salvar membro</UI>.</li>
                </Steps>
                <Bullets>
                  <li><strong>Situação simbólica automática:</strong> o sistema deduz Aprendiz, Companheiro, Mestre ou Mestre Instalado a partir dos marcos preenchidos — não se digita.</li>
                  <li><strong>Grau Filosófico atual:</strong> opcional, selecione de 4 a 33 (REAA); se vazio, vale a situação simbólica. Um cadastro antigo com valor fora desse intervalo aparece sinalizado como <strong>&quot;Grau inválido&quot;</strong> na lista — abra o membro e corrija.</li>
                  <li><strong>Tempo de Ordem:</strong> calculado da data de iniciação (ex.: &quot;12 anos e 3 meses&quot;).</li>
                  <li><strong>Origem:</strong> potência e loja de origem do irmão (se diferente da atual).</li>
                  <li><strong>Esta loja:</strong> em cada campo de nome de loja (Iniciação/Elevação/Exaltação/Instalação/Origem), marque <UI>Esta loja</UI> pra preencher automaticamente com o nome já cadastrado da própria loja, em vez de digitar — evita inconsistência de grafia entre cadastros (é o que a coluna Origem do Quadro social usa pra decidir &quot;Iniciado nesta loja&quot; vs &quot;Filiado&quot;).</li>
                </Bullets>
                <p>
                  <strong>Situações (afastamentos):</strong> além de Ativo, Suspenso e Inativo, há os afastamentos maçônicos —
                  <UI>Quit Placet</UI> (a pedido do membro), <UI>Placet Ex Officio</UI> (por determinação da Loja) e
                  <UI>Art. 002</UI> (com cobertura de direitos). Apenas membros <strong>Ativos</strong> entram na cobrança em massa.
                </p>
                <p>
                  <strong>Relatório em PDF:</strong> use o filtro de situação (ex.: Ativos) e clique em <UI>Relatório PDF</UI>
                  para gerar a lista dos membros conforme o filtro, com cabeçalho da loja.
                </p>
                <Note>
                  Preencha o <strong>CPF</strong> de quem terá cobrança via Asaas — é obrigatório para emitir boleto/PIX (ver 7.4).
                  A exclusão é bloqueada para quem já tem histórico financeiro ou documentos; nesse caso, <strong>inative</strong> em vez de excluir.
                </Note>
                <Note>
                  Recomenda-se orientar os irmãos a enviarem uma foto em <strong>traje de rigor maçônico</strong>
                  (paramentos da Loja) — é a foto que vai compor o Quadro da Gestão e a Galeria de Veneráveis, exibidos
                  publicamente no mural e em documentos impressos.
                </Note>
              </Sub>
              <Sub id="sec-quadro-social" title="8.2 Quadro social">
                <p>
                  Em <UI>Social → Quadro social</UI>, veja a fotografia atual do quadro agrupada por
                  <strong> grau simbólico</strong> (Aprendiz, Companheiro, Mestre, Mestre Instalado) — formato pensado
                  pra prestar contas à Potência.
                </p>
                <Steps>
                  <li>Por padrão, mostra só membros <UI>Ativos</UI>; marque <UI>Incluir afastados/suspensos/inativos</UI> pra ver todo mundo.</li>
                  <li>A tela lista cada grupo com foto, nome e um resumo por situação (ativo, afastado, suspenso, inativo) ao final. A foto é a mesma cadastrada em Membros — não precisa (nem deve) enviar de novo aqui.</li>
                  <li><UI>Salvar como PDF</UI> imprime com o timbre da loja.</li>
                </Steps>
                <Note>
                  É uma fotografia de <strong>hoje</strong>, não um relatório de admissões/desligamentos no ano — o
                  sistema não guarda a data de cada mudança de situação, só o valor atual.
                </Note>
                <Note>
                  A coluna <strong>Origem</strong> compara a <UI>Loja de iniciação</UI> (bloco Evolução maçônica, em
                  Membros) com o nome desta loja: iguais → <strong>Iniciado nesta loja</strong>; diferente →
                  <strong> Filiado</strong>; em branco → <strong>Sem origem cadastrada</strong> (nunca vira &quot;Filiado&quot;
                  só por falta de preenchimento — complete o cadastro pra sair dessa situação).
                </Note>
              </Sub>
              <Sub id="sec-galeria-veneraveis" title="8.3 Galeria de Veneráveis">
                <p>
                  Em <UI>Social → Galeria de Veneráveis</UI>, veja o mural com todos os Veneráveis da história da
                  loja, organizado pela <strong>linha do tempo</strong>.
                </p>
                <Bullets>
                  <li><strong>Entradas automáticas:</strong> qualquer irmão vinculado ao cargo de <UI>Venerável Mestre</UI> em algum período (em <UI>Veneralato</UI>) aparece aqui sozinho, com a foto cadastrada em Membros (se houver) e o período do veneralato.</li>
                  <li><strong>Entradas manuais:</strong> pra veneralatos antigos sem período/cargo registrado em <UI>Veneralato</UI> (atas antigas, placas na parede, ou simplesmente um período de gestão que nunca foi digitado no sistema), o Secretário, o Venerável ou o Administrador clicam em <UI>+ Adicionar Venerável antigo</UI> — nome, período em texto livre (ex.: &quot;1985–1987&quot;) e observações.</li>
                  <li>
                    <strong>Vincular a um membro cadastrado:</strong> se o Venerável do período já tem cadastro em Membros
                    (é um caso comum: a pessoa é membro, só falta o registro daquele período específico em Veneralato),
                    escolha o nome dela no seletor do formulário — a foto e o nome exibidos passam a vir sempre do
                    cadastro, exatamente como nas entradas automáticas. Sem vincular a ninguém, a entrada usa a foto
                    enviada manualmente (<UI>Enviar foto</UI>/<UI>Trocar foto</UI>).
                  </li>
                  <li>Entradas automáticas não são editáveis aqui — pra corrigir, ajuste o cargo em <UI>Veneralato</UI>. Entradas manuais têm <UI>Editar</UI> (nome, período, vínculo com membro) e <UI>Remover</UI>.</li>
                  <li><UI>Salvar como PDF</UI> imprime o mural com o timbre da loja.</li>
                </Bullets>
              </Sub>
              <Sub id="sec-quadro-gestao" title="8.4 Quadro da Gestão">
                <p>
                  Em <UI>Social → Quadro da Gestão</UI>, veja os cargos do <strong>período em exercício</strong>,
                  com foto — pronto pra mural, apresentações ou prestação de contas.
                </p>
                <Bullets>
                  <li>Só existe depois que um veneralato foi criado e teve cargos vinculados em <UI>Veneralato</UI> — antes disso, a tela orienta a ir lá primeiro.</li>
                  <li>Os cargos aparecem na ordem cerimonial do rito (Venerável Mestre primeiro), cada um com a foto do irmão cadastrada em Membros (ou um espaço reservado, se ainda não houver foto).</li>
                  <li><UI>Salvar como PDF</UI> imprime com o timbre da loja.</li>
                </Bullets>
              </Sub>
              <Sub id="sec-cadastros-mestre" title="8.5 Cadastros mestre e cargos">
                <p>
                  Em <UI>Cadastros mestre</UI> você gerencia <UI>Ritos</UI> e <UI>Potências</UI>, além do botão
                  <UI> Popular dados padrão (Brasil)</UI> que preenche ritos, potências e o plano de contas de uma vez.
                  O <UI>Plano de contas</UI>, <UI>Clientes e fornecedores</UI> (ver 7.13) e as <UI>Contas bancárias e
                  Caixa</UI> (ver 7.14) ficam em <UI>Cadastros financeiros</UI>, dentro de <UI>Tesouraria</UI> — são
                  cadastros de uso do Tesoureiro, separados dos de Ritos/Potências (Secretaria). Em <UI>Cargos</UI>,
                  mantém os cargos da loja conforme o rito.
                </p>
              </Sub>
              <Sub id="sec-veneralato" title="8.6 Veneralato (períodos e vínculos)">
                <p>
                  Em <UI>Veneralato</UI>, crie um <UI>Novo período</UI> (ex.: &quot;Gestão 2025-2026&quot;) e <UI>Vincular</UI> os
                  oficiais aos cargos daquele período.
                </p>
                <p>
                  O card <UI>Histórico de cargos</UI> junta os vínculos de <strong>todas as gestões</strong> (não só a
                  selecionada) agrupados por obreiro — clique em <UI>Ver histórico de cargos</UI> pra carregar. Útil
                  pra responder &quot;quem já foi Venerável Mestre&quot; ou &quot;quantas vezes fulano ocupou tal cargo&quot; sem abrir
                  período por período.
                </p>
                <Note>
                  Assim que o período em exercício tiver cargos vinculados, ele aparece automaticamente com fotos em
                  <Link className="text-gold hover:text-gold-light" href="#sec-quadro-gestao"> Social → Quadro da Gestão</Link>;
                  quem ocupou o cargo de Venerável Mestre em qualquer período entra na
                  <Link className="text-gold hover:text-gold-light" href="#sec-galeria-veneraveis"> Galeria de Veneráveis</Link>.
                </Note>
              </Sub>
              <Sub id="sec-sessoes" title="8.7 Sessões, ordem do dia e convocação">
                <p>
                  Em <UI>Secretaria → Veneralato & Sessões → Sessões</UI>, use <UI>Criar sessão</UI> informando título, <UI>Início</UI> e
                  <UI> Término</UI> (data e hora dos dois — o término define quando a presença libera, ver abaixo),
                  tipo, grau opcional e a <UI>Ordem do dia</UI> — o texto que os obreiros verão na Secretaria do
                  portal. As <UI>Observações internas</UI> ficam só para a diretoria, nunca aparecem para o membro.
                </p>
                <p>
                  Abra a sessão criada para acessar a tela de detalhe, com quatro blocos:
                </p>
                <Bullets>
                  <li><strong>Convocação (chamado):</strong> clique em <UI>Enviar convocação</UI> para disparar um e-mail a todos os obreiros <strong>ativos</strong>, com título, data/hora e ordem do dia da sessão. Pode ser reenviada quantas vezes precisar (ex.: após atualizar a ordem do dia) — cada envio fica registrado com data e hora.</li>
                  <li><strong>Ordem do dia:</strong> edite e clique em <UI>Salvar ordem do dia</UI> a qualquer momento.</li>
                  <li><strong>Balaustre / Ata:</strong> <strong>não é digitado no sistema</strong> — importe o arquivo (PDF ou Word) em <UI>Enviar arquivo</UI>. Depois de enviado, qualquer membro pode baixá-lo ao revisitar a sessão na Secretaria do portal (<UI>Baixar</UI>). <UI>Trocar arquivo</UI> substitui a versão anterior; <UI>Remover</UI> tira o arquivo da sessão.</li>
                  <li><strong>Registrar presença:</strong> toggle por obreiro (presente/ausente) — <strong>só libera depois do horário de término da sessão</strong> (campo <UI>Término</UI> da criação); antes disso os botões ficam desabilitados. Sessões criadas antes deste recurso (sem término definido) não são bloqueadas.</li>
                </Bullets>
                <Note>
                  O horário digitado em <UI>Início</UI>/<UI>Término</UI> é sempre interpretado como <strong>horário
                  de Brasília</strong>, e é assim que aparece de volta em toda a tela e no e-mail de convocação —
                  não precisa se preocupar com fuso horário do navegador.
                </Note>
                <Note>
                  <UI>Remover</UI> na lista de sessões pede confirmação antes de excluir (perde-se convocações,
                  presenças e o balaustre vinculados — ação sem volta) e fica registrado na Auditoria.
                </Note>
                <Note>
                  A ordem do dia e o balaustre de todas as sessões futuras e passadas formam o <strong>calendário da
                  Secretaria</strong> que o obreiro vê no portal (capítulo 10) — mantenha-os atualizados.
                </Note>
              </Sub>
              <Sub id="sec-frequencia" title="8.8 Frequência às sessões">
                <p>
                  Em <UI>Secretaria → Veneralato & Sessões → Frequência às sessões</UI>, veja quem tem faltado — a lista de obreiros ativos
                  fica ordenada pela pior frequência primeiro, com <UI>faltas seguidas</UI> destacada quando chega a 3
                  ou mais.
                </p>
                <Steps>
                  <li>Escolha o período (<UI>De</UI>/<UI>Até</UI>) ou um atalho: <UI>Ano atual</UI>, <UI>Últimos 6 meses</UI>, <UI>Últimos 12 meses</UI> ou <UI>Todas as sessões</UI>.</li>
                  <li>A tabela mostra, por obreiro: presenças, faltas, sessões <UI>não registradas</UI> (quando ninguém marcou presença/ausência) e a frequência em %.</li>
                  <li>Abaixo, a lista das sessões do período com o total de presentes/ausentes em cada uma — útil pra conferir se alguma sessão ficou sem registro de presença.</li>
                  <li><UI>Salvar como PDF</UI> imprime o relatório com o timbre da loja.</li>
                </Steps>
                <Note>
                  &quot;Não registrada&quot; é diferente de falta: significa que ninguém marcou presença daquele
                  obreiro naquela sessão (7.15 tem o mesmo cuidado nos extratos financeiros — o relatório nunca inventa
                  um dado que não foi lançado).
                </Note>
              </Sub>
              <Sub id="sec-materiais" title="8.9 Materiais e patrimônio">
                <p>
                  Em <UI>Secretaria → Membros & Cadastros → Materiais e patrimônio</UI>, mantenha o inventário de tudo que a loja usa
                  no dia a dia — não só alfaias e indumentária: colunas, altar, malhetes, espadas, tapete, urna,
                  estandarte, placa constitutiva, tábua de delinear, aventais, punhos, joias de cargo e rituais, tudo
                  num só lugar.
                </p>
                <Steps>
                  <li>Clique em <UI>Cadastrar material</UI> e informe nome, categoria, quantidade em estoque e, se fizer sentido, o <UI>grau exigido</UI> pra fornecer o item (ex.: um ritual só pode ir pra quem já tem aquele grau).</li>
                  <li>Ou clique em <UI>Carregar lista padrão</UI> pra já preencher o catálogo com um checklist de ~30 itens comuns — não duplica o que você já cadastrou.</li>
                </Steps>
                <p>
                  <strong>Fornecimento de materiais:</strong> no bloco de mesmo nome, escolha o material, o membro e a
                  quantidade, e clique em <UI>Registrar fornecimento</UI>. Se o material exigir um grau (ex.: Ritual de
                  Companheiro) e o membro ainda não o tiver alcançado, o sistema recusa — um Mestre continua elegível a
                  material de um grau que já passou, só não dá pra pular pra frente. Quando o item voltar, use
                  <UI> Marcar como devolvido</UI> (ou <UI>extraviado</UI>, se for o caso).
                </p>
                <Note>
                  Um material com fornecimento já registrado não pode ser excluído (preserva o histórico) — use
                  <UI> Inativar</UI> pra tirá-lo das opções de novos cadastros/fornecimentos sem perder o registro.
                </Note>
                <p>
                  O card <UI>Materiais em posse por obreiro</UI> reagrupa o fornecimento ativo por membro — mostra de
                  uma vez tudo que uma pessoa tem em mãos, pronto pra <UI>Salvar como PDF</UI> na hora de conferir ou
                  dar baixa em tudo de uma vez (ex.: desligamento).
                </p>
              </Sub>
              <Sub id="sec-documentos" title="8.10 Documentos e comunicação">
                <p>
                  Em <UI>Documentos</UI>, use <UI>Enviar e salvar documento</UI> (título + arquivo) para guardar atas,
                  comprovantes e certificados em armazenamento privado; o download é por link seguro temporário.
                </p>
                <p>
                  <strong>Documentos institucionais:</strong> deixe o campo <UI>Vincular a um membro</UI> em branco pra
                  publicar o arquivo pra <strong>toda a loja</strong> em vez de uma pessoa só — é assim que se
                  disponibiliza o Regimento Interno (da loja e da Potência), o Regulamento Geral e a Constituição da
                  Potência: o Secretário sobe o arquivo uma vez e todo obreiro passa a ver e baixar em <UI>Meu portal →
                  Documentos da Loja</UI> (capítulo 10). Use o campo <UI>Categoria</UI> (ex.: &quot;Institucional&quot;)
                  pra organizar a lista.
                </p>
                <p>
                  Em <UI>Comunicação</UI>, escreva um <UI>Título</UI> e o <UI>Texto da comunicação</UI>, escolha o
                  <UI> canal</UI> (E-mail, WhatsApp ou SMS) e <UI>Enviar a todos ou a um membro</UI>, e clique em
                  <UI> Enviar</UI> — a mensagem sai de verdade pelo canal escolhido, pros membros ativos (ou só pro
                  selecionado). Deixar em branco manda a todos os membros ativos.
                </p>
                <Note>
                  E-mail é provido pela plataforma (sempre disponível). WhatsApp e SMS dependem da loja ter conectado
                  a própria conta em <UI>Administração → Integrações</UI> (6.6) — sem isso, a mensagem fica
                  <strong> Na fila</strong> em vez de falhar, porque o canal simplesmente não está pronto ainda,
                  não porque algo deu errado.
                </Note>
                <p>
                  O card <UI>Histórico</UI> mostra as 200 mensagens mais recentes (inclusive os avisos automáticos de
                  aniversário, jubileu e cobrança), com rolagem interna e um campo de busca por título, membro ou
                  canal — assim ele não cresce sem limite conforme os avisos automáticos se acumulam. Quando uma
                  mensagem fica <UI>Na fila</UI> ou <UI>Falhou</UI>, o motivo aparece logo abaixo dela (ex.:
                  &quot;WhatsApp não conectado nesta loja&quot;) — não é preciso adivinhar o porquê.
                </p>
                <Note>
                  Envios em lote (a todos os membros) têm uma pequena pausa entre cada mensagem, pra não estourar o
                  limite de requisições por segundo do provedor de e-mail — um lote grande pode levar alguns segundos
                  a mais que antes, mas evita que uma fração das mensagens falhe por sobrecarga.
                </Note>
              </Sub>
            </Chapter>

            {/* ============== 9. VENERÁVEL ============== */}
            <Chapter id="veneravel" num="9" title="Guia do Venerável">
              <p>
                O Venerável tem visão gerencial completa, sem lançar baixas financeiras. Acompanhe:
              </p>
              <Bullets>
                <li><UI>Visão geral</UI>: <strong>Status financeiro</strong> e <strong>Ações rápidas</strong> — o pulso da loja.</li>
                <li><UI>Relatórios</UI>: arrecadação, inadimplência, fluxo de caixa e frequência por período.</li>
                <li><UI>Auditoria</UI> (se a loja conceder): a trilha imutável de quem fez o quê e quando — base para pareceres e aprovações.</li>
              </Bullets>
            </Chapter>

            {/* ============== 10. MEMBRO ============== */}
            <Chapter id="membro" num="10" title="Guia do Membro (obreiro)">
              <p>
                O membro tem uma área self-service: o <strong>portal do obreiro</strong>. Acesse pelo menu
                <UI>Visão geral → Meu portal</UI>. Lá você encontra:
              </p>
              <Bullets>
                <li><strong>Resumo do obreiro:</strong> seus dados — nome, e-mail, telefone, <strong>grau atual</strong> e loja de origem.</li>
                <li><strong>Resumo financeiro:</strong> três indicadores — <UI>A receber</UI>, <UI>A pagar</UI> e <UI>Pendentes</UI> (valores em aberto).</li>
                <li><strong>Meu extrato:</strong> cada conta vinculada a você — tipo (a receber/a pagar), categoria do plano de contas (ex.: Mensalidades, Tronco de Beneficência), vencimento, valor e status. Filtre por tipo e por status, e use <UI>Relatório PDF</UI> para imprimir/salvar o extrato filtrado.</li>
                <li><strong>Documentos recentes:</strong> os arquivos disponibilizados a você pela loja.</li>
                <li><strong>Documentos da Loja:</strong> regimento interno, regulamento geral, constituição da Potência e outros documentos institucionais, publicados pela Secretaria pra todos os obreiros — abra ou baixe direto por aqui.</li>
              </Bullets>
              <p>
                Assim você confere, a qualquer momento, <strong>o que pagou, o que está em aberto, do que se trata e o que
                vence</strong> — sem precisar pedir à tesouraria.
              </p>
              <Note>
                Se a sua mensalidade ficar em aberto por mais de <strong>60 dias</strong>, um aviso vermelho aparece por
                alguns segundos ao entrar no painel, pedindo para você procurar o Tesoureiro ou o Venerável Mestre
                (situação prevista no Art. 002 do regimento — ver capítulo 7.8). Ele some sozinho assim que a pendência
                for paga ou excluída pela tesouraria. Esse aviso automático só aparece se a sua loja mantiver o
                enquadramento automático do Art. 002 ligado em Configurações; algumas lojas preferem tratar isso
                manualmente.
              </Note>
              <Sub id="membro-acesso" title="10.1 Seu acesso e seus dados">
                <Bullets>
                  <li><strong>Primeiro acesso:</strong> entre com o e-mail e a senha provisória recebida por e-mail; o sistema pede para você <strong>definir uma nova senha</strong>.</li>
                  <li><strong>Editar meus dados:</strong> clique em <UI>Editar meus dados</UI> no topo do Resumo do obreiro para atualizar contato, endereço e família (mãe, pai, cônjuge, dependentes) — inclusive marcar <UI>Falecido(a)</UI> um familiar, o que já para as felicitações de aniversário automáticas para ele. O seu <strong>papel/cargo</strong>, CPF, rito/potência e evolução maçônica só são alterados pelo Administrador ou Secretaria.</li>
                  <li><strong>Trocar senha:</strong> a qualquer momento, em <UI>/trocar-senha</UI>, informando a senha atual.</li>
                  <li><strong>Tema Papiro:</strong> prefere a interface clara? Veja a seção Aparência (capítulo 6.1) — a escolha vale para o seu navegador.</li>
                </Bullets>
              </Sub>
              <Sub id="membro-secretaria" title="10.2 Secretaria: o calendário de sessões">
                <p>
                  Em <UI>Visão geral → Calendário de sessões</UI> (ao lado de <UI>Meu portal</UI> — todo oficial
                  também é obreiro, então vale pra todos os papéis) você vê um <strong>calendário mensal</strong>,
                  como uma agenda de parede: cada dia com sessão marcada mostra um chip com o horário e o título. No topo, o destaque
                  <UI> Próxima convocação</UI> traz a data, hora e ordem do dia da <strong>próxima sessão</strong> de
                  relance, sem precisar procurar no calendário.
                </p>
                <p>
                  Clique em qualquer sessão (passada ou futura) para abrir o detalhe abaixo do calendário, com a
                  <UI> Ordem do dia</UI> e, depois de realizada, um link <UI>Baixar</UI> para o arquivo do
                  <UI> Balaustre/Ata</UI> (PDF ou Word) importado pela Secretaria. Use as setas
                  <UI> ← Mês anterior</UI> / <UI>Mês seguinte →</UI> para navegar entre meses.
                </p>
                <Note>Você recebe um e-mail de convocação automaticamente quando a Secretaria envia o chamado da sessão (capítulo 8).</Note>
              </Sub>
              <Sub id="membro-hospitalaria" title="10.3 Hospitalaria: campanhas e pedidos de auxílio">
                <p>
                  Em <UI>Hospitalaria</UI> você acompanha as <strong>campanhas de benemerência ativas</strong> da loja
                  (título, descrição, beneficiário e progresso da arrecadação) — mesma informação que o Hospitaleiro vê,
                  em modo leitura.
                </p>
                <p>
                  Para propor uma campanha ou pedir um auxílio, clique em <UI>Propor campanha / solicitar auxílio</UI>,
                  preencha o <UI>Título</UI> e descreva a situação, e clique em <UI>Enviar pedido</UI>. O pedido
                  <strong> não vira uma campanha automaticamente</strong> — ele é uma mensagem direta para o Hospitaleiro
                  e a Administração da loja (chega por e-mail), que decidem se formalizam uma campanha a partir dele.
                </p>
              </Sub>
            </Chapter>

            {/* ============== 11. HOSPITALEIRO ============== */}
            <Chapter id="hospitaleiro" num="11" title="Guia do Hospitaleiro">
              <p>
                O Hospitaleiro cuida do bem-estar dos irmãos e da benemerência da loja. No Sigma Horus, ele consulta os
                irmãos para manter contato, gerencia <strong>campanhas de doação</strong> e acompanha o <strong>Tronco de
                Solidariedade</strong>. O menu fica em <UI>Hospitalaria</UI> (o Administrador e o Venerável também acessam).
              </p>

              <Sub id="hosp-irmaos" title="11.1 Irmãos (consulta)">
                <p>
                  Em <UI>Hospitalaria → Irmãos (consulta)</UI> você vê a lista de obreiros em <strong>somente leitura</strong>,
                  com <UI>busca</UI> por nome, telefone ou e-mail. Clique numa linha para ver os contatos do irmão e os da
                  <strong> família</strong> (mãe, pai, esposa, filhos) — úteis para visitas, acompanhamento e felicitações.
                </p>
                <Note>Esta tela não permite editar nem excluir cadastros: o cadastro dos membros é feito pela Secretaria (capítulo 8).</Note>
              </Sub>

              <Sub id="hosp-tronco" title="11.2 O Tronco de Solidariedade">
                <p>
                  O Tronco de Solidariedade é o dinheiro reservado à benemerência: <strong>faz parte do caixa total da loja,
                  mas fica em conta separada</strong>, com finalidade específica. O Hospitaleiro acompanha o seu
                  <strong> saldo disponível</strong> no topo da tela de Campanhas.
                </p>
                <p>
                  O saldo é calculado pela contabilidade: <strong>entradas do Tronco</strong> (conta &quot;Tronco de
                  Beneficência&quot;) menos os <strong>gastos de benemerência</strong> (conta &quot;Ação Social e Caridade&quot;).
                  Se o saldo aparecer indisponível, peça ao Tesoureiro/Administrador para clicar em <UI>Atualizar plano de
                  contas</UI> em Cadastros (capítulo 7.1) — isso habilita as contas do Tronco.
                </p>
              </Sub>

              <Sub id="hosp-campanha" title="11.3 Criar uma campanha">
                <p>Em <UI>Hospitalaria → Campanhas</UI>, clique em <UI>+ Nova campanha</UI>:</p>
                <Steps>
                  <li>(Opcional) Escolha um <UI>Modelo</UI> entre os exemplos (cadeira de rodas, cesta básica, auxílio funeral, material escolar, medicamentos, doação a instituição) — ele preenche título e descrição.</li>
                  <li>Ajuste o <UI>Título</UI> e a <UI>Meta</UI> (valor estimado, opcional).</li>
                  <li>Em <strong>Para quem?</strong>, escolha o beneficiário: <UI>Pessoa física</UI>, <UI>Empresa</UI> ou <UI>Instituição</UI>, e informe o nome.</li>
                  <li>Defina a <UI>Fonte</UI>: <strong>Tronco de Solidariedade</strong> (se houver fundo), <strong>Doação voluntária dos irmãos</strong> ou <strong>Tronco + doações</strong>.</li>
                  <li>Escreva a <UI>Descrição</UI> e clique em <UI>Criar campanha</UI>.</li>
                </Steps>
                <p>
                  Cada campanha mostra o <strong>progresso</strong> (arrecadado em relação à meta). Clique nela para abrir o
                  detalhe e registrar doações, custear pelo Tronco, convocar os irmãos e, ao final, <UI>Concluir</UI> ou
                  <UI> Cancelar</UI>.
                </p>
              </Sub>

              <Sub id="hosp-doacoes" title="11.4 Registrar doações e custear pelo Tronco">
                <p><strong>Doação voluntária dos irmãos</strong> (no detalhe da campanha, bloco <UI>Registrar doação</UI>):</p>
                <Steps>
                  <li>Informe o <UI>Valor</UI> e o <UI>Nome do doador</UI>. Marque <UI>Doador anônimo</UI> se ele preferir não ser identificado (o nome é guardado, mas exibido como &quot;Doador anônimo&quot;).</li>
                  <li>Clique em <UI>Registrar</UI>. Cada doação <strong>entra no financeiro automaticamente</strong>, como receita na conta do Tronco — sem lançamento manual do Tesoureiro.</li>
                </Steps>
                <p><strong>Custear pela própria loja</strong> (bloco <UI>Custear pelo Tronco</UI>):</p>
                <Steps>
                  <li>Veja o <strong>saldo disponível</strong> do Tronco e quanto a campanha já consumiu.</li>
                  <li>Informe o valor e clique em <UI>Custear</UI>. O sistema lança a despesa de benemerência e reduz o saldo do Tronco — o valor não pode ultrapassar o saldo disponível.</li>
                </Steps>
              </Sub>

              <Sub id="hosp-convocar" title="11.5 Convocar os irmãos">
                <p>
                  No detalhe da campanha, o bloco <UI>Convocar os irmãos</UI> dispara um chamado à participação. Escolha os
                  <strong> canais</strong> (<UI>E-mail</UI>, <UI>WhatsApp</UI>, <UI>SMS</UI>), o <strong>público</strong>
                  (irmãos ativos ou todos) e, se quiser, escreva uma mensagem própria (em branco, o sistema usa um texto
                  padrão com o resumo da campanha). Clique em <UI>Convocar</UI>.
                </p>
                <Note>
                  Todo envio fica registrado no histórico de <UI>Comunicação</UI>. O <strong>envio externo real</strong>
                  por e-mail já sai de imediato (provido pela plataforma); WhatsApp/SMS saem quando a loja conectar a
                  própria conta em <UI>Integrações</UI> (ver 6.6). Até lá, esses ficam <strong>enfileirados</strong> e
                  prontos para sair, no histórico de Comunicação.
                </Note>
              </Sub>

              <Sub id="hosp-pedidos" title="11.6 Pedidos dos obreiros">
                <p>
                  Na tela de <UI>Campanhas</UI>, o bloco <UI>Pedidos dos obreiros</UI> lista os pedidos de auxílio que os
                  membros enviaram pela aba Hospitalaria do próprio portal (capítulo 10) — título, descrição, quem pediu
                  e a data. Um selo mostra quantos ainda estão <strong>pendentes</strong>.
                </p>
                <p>
                  Você recebe um e-mail assim que um pedido chega. Depois de avaliar, clique em <UI>Marcar como
                  analisado</UI> — o selo de pendentes atualiza e o pedido fica marcado como tratado (é possível
                  <UI> reabrir</UI> se precisar revisar de novo). Se decidir formalizar o pedido, crie uma campanha
                  normalmente em <UI>+ Nova campanha</UI> (11.3), usando o pedido como referência.
                </p>
              </Sub>
            </Chapter>

            {/* ============== 12. ASSINATURA ============== */}
            <Chapter id="assinatura" num="12" title="Assinatura e cobrança">
              <p>
                A loja paga ao Sigma Horus pela plataforma (assinatura) — isso é diferente das cobranças que a loja faz
                aos seus membros (essas caem direto na conta da loja, pelo Asaas). Os planos são por faixa de obreiros
                ativos:
              </p>
              <Bullets>
                <li><strong>Oficina</strong> — até 30 membros — R$ 80,00/mês.</li>
                <li><strong>Loja</strong> — 31 a 80 membros — R$ 110,00/mês.</li>
                <li><strong>Potência</strong> — 81+ ou multiloja — R$ 170,00/mês.</li>
              </Bullets>
              <p>Formas de contratação:</p>
              <Bullets>
                <li><strong>Mensal no cartão:</strong> cobrança recorrente todo mês.</li>
                <li><strong>Anual no cartão:</strong> 12 meses com <strong>10% de desconto</strong> e renovação automática.</li>
                <li><strong>Anual no boleto:</strong> pago de uma vez, com <strong>5% de desconto</strong> e sem renovação automática. O acesso é liberado <strong>após a confirmação</strong> do pagamento.</li>
              </Bullets>
              <p>
                <strong>Teste grátis com cartão (autocadastro):</strong> ao assinar pelo site no cartão, você ganha
                <strong> 10 dias de teste</strong> sem nenhuma cobrança. Ao fim do período, a cobrança ocorre
                automaticamente <strong>se você não cancelar</strong> em <UI>Administração → Assinatura</UI>. É possível
                cancelar a qualquer momento durante o teste, sem custo.
              </p>
              <Note>O <strong>período de teste de 10 dias</strong> é gratuito: nada é debitado durante o teste.</Note>
            </Chapter>

            {/* ============== 13. REGRAS ============== */}
            <Chapter id="regras" num="13" title="Reembolso, upgrade e downgrade">
              <Bullets>
                <li><strong>Sem reembolso:</strong> após a contratação não há devolução de valores já pagos do período vigente.</li>
                <li><strong>Upgrade (subir de plano):</strong> vale <strong>imediatamente</strong>, com cobrança proporcional da diferença.</li>
                <li><strong>Downgrade (descer de plano):</strong> passa a valer <strong>só ao fim do período já contratado</strong>; você mantém o plano atual até lá e nada é devolvido. Um aviso no topo do painel mostra a data em que o downgrade entra em vigor.</li>
              </Bullets>
              <p>Você gerencia tudo em <UI>Administração → Assinatura</UI>.</p>
            </Chapter>

            {/* ============== 14. SEGURANÇA ============== */}
            <Chapter id="seguranca" num="14" title="Privacidade, segurança e LGPD">
              <p>
                O Sigma Horus é <strong>software</strong> de gestão; não é instituição financeira nem custodia valores.
                Os dados de cada loja são isolados (Row-Level Security), trafegam cifrados (TLS) e o acesso é por papel.
                Toda alteração relevante fica registrada na <UI>Auditoria</UI>.
              </p>
              <p>
                No tratamento de dados pessoais, em regra a <strong>loja é a controladora</strong> e o Sigma Horus atua
                como <strong>operador</strong>. Use os dados dos obreiros com base legal e finalidade legítima, conforme a
                LGPD.
              </p>
              <p>
                Fazemos <strong>backup automático e criptografado</strong> de toda a plataforma diariamente, guardado por
                30 dias, para reconstrução em caso de problema grave com a infraestrutura. Além disso, o Administrador
                pode baixar a qualquer momento uma cópia completa dos dados da própria loja em <UI>Administração →
                Configurações da loja → Baixar backup completo da minha loja</UI> (veja 6.8).
              </p>
              <p>
                Detalhes completos nos{' '}
                <Link className="text-gold hover:text-gold-light" href="/termos">Termos de Uso</Link>, na{' '}
                <Link className="text-gold hover:text-gold-light" href="/privacidade">Política de Privacidade e LGPD</Link> e na{' '}
                <Link className="text-gold hover:text-gold-light" href="/compliance">página de Compliance</Link>.
              </p>
            </Chapter>

            {/* ============== 15. DÚVIDAS ============== */}
            <Chapter id="duvidas" num="15" title="Dúvidas frequentes">
              <Bullets>
                <li><strong>Não consigo emitir boleto.</strong> Verifique se o Asaas está conectado (6.2) e se o membro tem CPF (7.4).</li>
                <li><strong>O pagamento não baixou sozinho.</strong> Confirme o webhook e o token no painel do Asaas (6.2-C).</li>
                <li><strong>Meu acesso foi pausado.</strong> O teste de 10 dias terminou — contrate um plano em <UI>Assinatura</UI>; seus dados continuam guardados.</li>
                <li><strong>Não vejo um item do menu.</strong> Ele não está liberado para o seu papel; fale com o Administrador (6.3 / 6.4).</li>
                <li><strong>O saldo do Tronco aparece indisponível.</strong> Em Cadastros, clique em <UI>Atualizar plano de contas</UI> (7.1) para habilitar as contas do Tronco de Solidariedade.</li>
                <li><strong>A convocação não chegou aos irmãos.</strong> O e-mail sai pela plataforma; WhatsApp/SMS exigem a loja conectar a própria conta em <UI>Integrações</UI> (6.6). Até lá, ficam registrados e enfileirados.</li>
                <li><strong>Quero o manual em PDF.</strong> Use o botão <strong>Salvar como PDF</strong> no topo desta página.</li>
                <li><strong>Não consigo registrar um pagamento.</strong> Desde a versão 1.3, todo pagamento exige escolher a <UI>Conta bancária/caixa</UI> que recebeu ou pagou o valor — cadastre pelo menos uma em <UI>Cadastros financeiros → Contas bancárias e Caixa</UI> (7.14) antes de registrar.</li>
                <li><strong>A transferência entre contas não mudou o saldo.</strong> Toda transferência nasce pendente e só afeta o saldo depois que o Venerável Mestre (ou o Administrador) aprovar, no <UI>Histórico</UI> da tela de Transferências (7.14).</li>
                <li><strong>Não consigo fornecer um ritual/material a um membro.</strong> O material tem um grau exigido e o membro ainda não chegou lá (ex.: Companheiro pedindo Ritual de Mestre) — ou não há quantidade disponível em estoque. Veja Materiais e patrimônio (capítulo 8).</li>
                <li><strong>Onde encontro o Regimento Interno / Constituição da Potência?</strong> Em <UI>Meu portal → Documentos da Loja</UI>, se a Secretaria já tiver publicado (capítulo 10).</li>
                <li><strong>O brasão não aparece nos documentos.</strong> Envie a imagem em <UI>Administração → Configurações da loja → Identificação → Enviar imagem</UI> (6.1). Documentos já gerados antes do envio não são retroativos.</li>
              </Bullets>
            </Chapter>
          </article>
        </div>
      </div>
    </>
  );
}
