'use client';

import Link from 'next/link';
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
    ],
  },
  { id: 'secretario', num: '8', label: 'Guia do Secretário' },
  { id: 'veneravel', num: '9', label: 'Guia do Venerável' },
  { id: 'membro', num: '10', label: 'Guia do Membro (obreiro)' },
  { id: 'hospitaleiro', num: '11', label: 'Guia do Hospitaleiro' },
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
  .manual-print .manual-chapter h2 span { color: #6b551d !important; }
  .manual-print .manual-steps { color: #1b1b1b !important; }
}
`;

/* ------------------------------------------------------------------ */
/* Componente principal                                               */
/* ------------------------------------------------------------------ */

export function ManualBook() {
  const [openIdx, setOpenIdx] = useState(false);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-14">
        {/* Barra de ações (não imprime) */}
        <div className="manual-noprint mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Guia do usuário</p>
            <h1 className="mt-2 text-3xl font-bold text-sand-light lg:text-4xl">Manual do Sigma Horus</h1>
            <p className="mt-1 text-sm text-sand-dark">Atualizado em 27 de junho de 2026 · versão 1.1</p>
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
                <h1 style={{ fontSize: '30pt', margin: '1.5cm 0 0.4cm' }}>Manual do Usuário</h1>
                <p style={{ fontSize: '13pt', fontStyle: 'italic' }}>A tesouraria da sua loja no prumo</p>
                <p style={{ marginTop: '4cm', fontSize: '11pt' }}>Versão 1.1 — 27 de junho de 2026</p>
              </div>
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
                <li>Depois vá direto ao <strong>guia do seu perfil</strong>: Administrador (6), Tesoureiro (7), Secretário (8), Venerável (9) ou Membro (10).</li>
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
                <li><strong>Venerável:</strong> visão gerencial completa, relatórios e aprovações; não lança baixas financeiras.</li>
                <li><strong>Tesoureiro:</strong> lança e baixa contas, emite cobranças, fecha o caixa e vê relatórios financeiros.</li>
                <li><strong>Secretário:</strong> membros, cargos, períodos, sessões e presença; relatórios não financeiros.</li>
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
              <Bullets>
                <li><strong>Visão geral:</strong> <UI>Visão geral</UI> (indicadores), <UI>Meu portal</UI> e <UI>Manual &amp; ajuda</UI>.</li>
                <li><strong>Loja &amp; cadastros:</strong> <UI>Membros</UI>, <UI>Cadastros mestre</UI>, <UI>Cargos</UI>, <UI>Veneralato</UI>.</li>
                <li><strong>Financeiro:</strong> <UI>Contas</UI>, <UI>Cobranças</UI>, <UI>Pagamentos</UI>, <UI>Relatórios</UI>.</li>
                <li><strong>Atividades:</strong> <UI>Sessões</UI>, <UI>Documentos</UI>, <UI>Comunicação</UI>.</li>
                <li><strong>Hospitalaria:</strong> <UI>Irmãos (consulta)</UI> e <UI>Campanhas</UI> de benemerência.</li>
                <li><strong>Administração:</strong> <UI>Configurações da loja</UI>, <UI>Assinatura</UI>, <UI>Integrações</UI>, <UI>Auditoria</UI>.</li>
              </Bullets>
              <p>O topo mostra o nome da loja, o usuário logado e o status da assinatura (teste, ativa ou pendente).</p>
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
                <Office name="Secretário" tradition="A administração viva da loja: convocações, atas, correspondência e o quadro de obreiros." system="Recebe o papel Secretário: cadastra membros, cargos, períodos e sessões; registra presença; organiza o Centro de Documentos." />
                <Office name="Tesoureiro" tradition="O coração financeiro: arrecada mensalidades, paga despesas e presta contas do caixa." system="Recebe o papel Tesoureiro: emite cobranças (boleto/PIX), dá baixas, lança contas e fecha o caixa do veneralato." />
                <Office name="Chanceler" tradition="Cuida das relações externas, diplomas, certificados e correspondência com a Potência." system="Papel Secretário ou Membro; usa o Centro de Documentos e os cadastros de membros." />
                <Office name="Hospitaleiro" tradition="O cuidado fraterno: assistência a obreiros e famílias, tronco de beneficência, visitas e aniversários." system="Recebe o papel Hospitaleiro: consulta os irmãos e a família para contato, gerencia campanhas de benemerência e acompanha o saldo do Tronco de Solidariedade (ver capítulo 11)." />
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
                  <li><strong>Identificação:</strong> nome, razão social, nome fantasia, CNPJ, contato e endereço (o CEP preenche o endereço).</li>
                  <li><strong>Dados bancários</strong> e <strong>chave PIX</strong> (úteis para conferência e conciliação).</li>
                  <li><strong>Loja maçônica:</strong> o <UI>Rito</UI> praticado e a <UI>Potência</UI> (obediência). O rito define os cargos da loja.</li>
                  <li><strong>Sessões:</strong> marque os <UI>dias da semana</UI> e a <UI>periodicidade</UI> (semanal, quinzenal ou mensal) das sessões.</li>
                </Bullets>
                <p>
                  Se trocar o rito, clique em <UI>Aplicar cargos deste rito</UI> para incluir os cargos correspondentes
                  (a ação só adiciona o que falta — não remove os cargos existentes).
                </p>
                <Note>Mantenha o CNPJ e os dados bancários corretos: eles aparecem em relatórios e ajudam na conciliação financeira.</Note>
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

              <Sub id="admin-usuarios" title="6.3 Convidar e gerenciar usuários">
                <p>
                  Cada oficial que vai operar o sistema precisa de um usuário com um papel. O Administrador convida as
                  pessoas e define o papel de cada uma (ver papéis no capítulo 3).
                </p>
                <Note>O papel define o que a pessoa pode ver e fazer. Conceda o <strong>menor privilégio necessário</strong>: por exemplo, dê o papel Tesoureiro apenas a quem cuida do caixa.</Note>
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
                  Consulte e ajuste em <UI>Cadastros mestre → Plano de contas</UI>. Para completar com o modelo padrão,
                  use <UI>Popular dados padrão (Brasil)</UI> (adiciona apenas os códigos que faltam, sem duplicar). Para
                  retirar uma conta que não usa, clique em <UI>Remover</UI> ao lado dela.
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
                <p>Em <UI>Financeiro → Contas</UI>, no bloco <UI>Nova conta</UI>:</p>
                <Steps>
                  <li>Escolha a <UI>Categoria (plano de contas)</UI> — ela já sugere o título e o tipo.</li>
                  <li>Confira o <UI>Título da conta</UI> e o tipo: <strong>Conta a receber</strong> ou <strong>Conta a pagar</strong>.</li>
                  <li>Informe o <UI>Valor</UI> e a <UI>Data</UI> de vencimento.</li>
                  <li>Defina o <UI>Status</UI> (Pendente, Pago ou Vencido).</li>
                  <li>Opcional: <UI>Vincular a um membro</UI> e escrever uma <UI>Descrição</UI>.</li>
                  <li>Clique em <UI>Salvar conta</UI>. A conta aparece na lista <UI>Contas cadastradas</UI>; use <UI>Remover</UI> para excluir.</li>
                </Steps>
              </Sub>

              <Sub id="tes-cobrancas" title="7.3 Criar cobranças e recorrência">
                <p>
                  Cobranças são os títulos que você gera para receber dos membros. Em <UI>Financeiro → Cobranças</UI>, no
                  bloco <UI>Nova cobrança</UI>:
                </p>
                <Steps>
                  <li>Selecione a <UI>conta</UI> (a receber) à qual a cobrança se refere.</li>
                  <li><UI>Vincular a um membro</UI> — necessário se você for emitir boleto/PIX depois (ver 7.4).</li>
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
                  bloco <UI>Cobrança em massa</UI> — escolha a conta, o público (membros ativos ou todos), o valor por
                  membro e o vencimento, e clique em <UI>Gerar para todos os membros</UI>. Cria uma cobrança numerada
                  automaticamente para cada membro (e, se marcado, recorrente).
                </p>
                <p>
                  Na lista <UI>Cobranças cadastradas</UI>, cada item mostra um status: <strong>Pendente</strong>,
                  <strong> Emitida</strong>, <strong>Paga</strong> ou <strong>Vencida</strong>.
                </p>
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
                  <UI>Financeiro → Pagamentos</UI>, bloco <UI>Novo pagamento</UI>:
                </p>
                <Steps>
                  <li>Selecione a <UI>conta</UI> correspondente e, se quiser, <UI>vincule a um membro</UI>.</li>
                  <li>Informe o <UI>Valor</UI> e a <UI>Data</UI> do pagamento.</li>
                  <li>Escolha o <UI>método</UI>: Manual, PIX, Dinheiro ou Cartão.</li>
                  <li>Opcional: <UI>Observação</UI>.</li>
                  <li>Marque a <strong>declaração de ciência</strong> (confirma a veracidade e o aceite dos Termos) — obrigatória.</li>
                  <li>Clique em <UI>Registrar pagamento</UI>. Ele aparece em <UI>Pagamentos recentes</UI>.</li>
                </Steps>
              </Sub>

              <Sub id="tes-relatorios" title="7.6 Relatórios e fechamento">
                <p>
                  Em <UI>Financeiro → Relatórios</UI> você acompanha <UI>Resumo de abertura</UI>, <UI>Próximos
                  vencimentos</UI> e <UI>Últimos registros</UI>, com <strong>filtro por período</strong> e <UI>Exportar</UI> (CSV).
                </p>
                <p>
                  Em <UI>Financeiro → Fechamento</UI> está o <strong>relatório financeiro completo</strong> no formato livro
                  caixa, para o fechamento do veneralato: <strong>Balanço Financeiro</strong>, <strong>Balancete por plano
                  de contas</strong>, <strong>Receitas × Despesas</strong> mensal, <strong>Livro Caixa</strong>,
                  <strong> Cobranças</strong> e <strong>Saldo dos Associados</strong>. Escolha o período e use
                  <UI>Salvar como PDF</UI> para gerar o documento. As contas são agrupadas pelo plano de contas (código),
                  então vincule cada lançamento a uma <strong>categoria do plano de contas</strong> para o relatório sair correto.
                </p>
              </Sub>

              <Sub id="tes-fechamento" title="7.7 Fechamento do veneralato">
                <p>
                  Ao fim da gestão, em <UI>Loja &amp; cadastros → Veneralato</UI> você apura o período. Abra o período,
                  confira o <strong>Saldo</strong> e use o <UI>Fechamento de caixa</UI> → <UI>Fechar caixa</UI> para
                  travar os lançamentos e transferir o saldo à próxima gestão.
                </p>
              </Sub>
            </Chapter>

            {/* ============== 8. SECRETÁRIO ============== */}
            <Chapter id="secretario" num="8" title="Guia do Secretário">
              <p>O Secretário mantém o quadro de obreiros, a estrutura de cargos, as sessões e os documentos.</p>
              <Sub title="Membros — buscar, cadastrar, editar e excluir">
                <p>
                  Em <UI>Loja &amp; cadastros → Membros</UI>, a tela abre com a <strong>lista de obreiros</strong> em formato
                  de tabela compacta. Use a <UI>busca</UI> (por <strong>nome, CPF ou CIM</strong>) e o filtro de
                  <UI> situação</UI> para encontrar rapidamente. Clique numa linha para <strong>expandir</strong> os detalhes,
                  onde ficam os botões <UI>Editar</UI> e <UI>Excluir cadastro</UI>.
                </p>
                <Steps>
                  <li>Clique em <UI>+ Novo membro</UI>. Só o <strong>nome</strong> é obrigatório; os demais blocos abrem conforme a necessidade.</li>
                  <li><strong>Essencial:</strong> nome, e-mail, telefone, situação, rito e potência atual.</li>
                  <li><strong>Dados pessoais:</strong> nascimento, <strong>CPF</strong>, RG, estado civil, profissão e nacionalidade.</li>
                  <li><strong>Família e dependentes:</strong> Mãe, Pai e Esposa (com nascimento, e-mail e telefone) e a lista de dependentes (Filho/Filha/Outro, com CPF e contatos). Esses contatos servem às felicitações da Hospitalaria.</li>
                  <li><strong>Endereço:</strong> o <UI>CEP</UI> preenche o endereço automaticamente.</li>
                  <li><strong>Evolução maçônica:</strong> os marcos <strong>Iniciação, Elevação, Exaltação e Instalação</strong> (data + loja de cada um).</li>
                  <li>Clique em <UI>Salvar membro</UI>.</li>
                </Steps>
                <Bullets>
                  <li><strong>Situação simbólica automática:</strong> o sistema deduz Aprendiz, Companheiro, Mestre ou Mestre Instalado a partir dos marcos preenchidos — não se digita.</li>
                  <li><strong>Grau Filosófico atual:</strong> opcional, selecione de 4 a 33 (REAA); se vazio, vale a situação simbólica.</li>
                  <li><strong>Tempo de Ordem:</strong> calculado da data de iniciação (ex.: &quot;12 anos e 3 meses&quot;).</li>
                  <li><strong>Origem:</strong> potência e loja de origem do irmão (se diferente da atual).</li>
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
              </Sub>
              <Sub title="Cadastros mestre e cargos">
                <p>
                  Em <UI>Cadastros mestre</UI> você gerencia <UI>Ritos</UI>, <UI>Potências</UI> e o <UI>Plano de contas</UI>
                  (Adicionar/Remover). Em <UI>Cargos</UI>, mantém os cargos da loja conforme o rito.
                </p>
              </Sub>
              <Sub title="Veneralato (períodos e vínculos)">
                <p>
                  Em <UI>Veneralato</UI>, crie um <UI>Novo período</UI> (ex.: &quot;Gestão 2025-2026&quot;) e <UI>Vincular</UI> os
                  oficiais aos cargos daquele período.
                </p>
              </Sub>
              <Sub title="Sessões e presença">
                <p>
                  Em <UI>Atividades → Sessões</UI>, use <UI>Criar sessão</UI> (título, grau opcional, observações). Em
                  cada sessão, registre a <strong>presença</strong> dos membros (toggle por obreiro) para acompanhar a
                  frequência.
                </p>
              </Sub>
              <Sub title="Documentos e comunicação">
                <p>
                  Em <UI>Documentos</UI>, use <UI>Enviar e salvar documento</UI> (título + arquivo) para guardar atas,
                  comprovantes e certificados em armazenamento privado; o download é por link seguro temporário. Em
                  <UI>Comunicação</UI>, registre avisos aos membros (recurso em evolução).
                </p>
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
                <li><strong>Últimas contas:</strong> cada conta vinculada a você, com tipo (Receber/Pagar), vencimento, valor e status.</li>
                <li><strong>Documentos recentes:</strong> os arquivos disponibilizados a você pela loja.</li>
              </Bullets>
              <p>
                Assim você confere, a qualquer momento, <strong>o que pagou, o que está em aberto e o que vence</strong> —
                sem precisar pedir à tesouraria.
              </p>
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
            </Chapter>

            {/* ============== 12. ASSINATURA ============== */}
            <Chapter id="assinatura" num="12" title="Assinatura e cobrança">
              <p>
                A loja paga ao Sigma Horus pela plataforma (assinatura) — isso é diferente das cobranças que a loja faz
                aos seus membros (essas caem direto na conta da loja, pelo Asaas). Os planos são por faixa de obreiros
                ativos:
              </p>
              <Bullets>
                <li><strong>Oficina</strong> — até 30 membros — R$ 60,00/mês.</li>
                <li><strong>Loja</strong> — 31 a 80 membros — R$ 90,00/mês.</li>
                <li><strong>Potência</strong> — 81+ ou multiloja — R$ 180,00/mês.</li>
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
              </Bullets>
            </Chapter>
          </article>
        </div>
      </div>
    </>
  );
}
