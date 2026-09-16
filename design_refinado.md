Design Refinado — Sigma Horus
==============================

Propósito: orientar a evolução da interface do Sigma Horus com base numa crítica de
design (skill impeccable, registro Product) do estado atual já em produção. O foco
não é "parecer moderno"; é a tesouraria operar com confiança e a ferramenta sumir
dentro da tarefa. Referências de mercado úteis como aferição, não como cópia: Linear,
Stripe Dashboard, Notion (densidade, consistência, foco), com a identidade egípcia
(Olho de Hórus, ouro do deserto, céu noturno) já consolidada nos tokens.

Documento vivo. Não altera código por si; consolida decisões. Fonte da verdade visual.


1. Aferição (impeccable critique, 2026-06-30)
---------------------------------------------

Registro: Product. O teste de slop aqui não é "parece feito por IA"; é "um tesoureiro
fluente em boas ferramentas confia e flui, ou trava em cada componente sutilmente
errado?". A barra é familiaridade conquistada.

Saúde do design (heurísticas de Nielsen, leitura honesta): ~28/40, faixa "Bom, com
folga clara para subir". Resumo dos pontos que puxam a nota:

- Consistência (3/4): o design system (Card, Button, Input, Badge) é coeso, mas os
  avisos/alertas são `div`s com classes Tailwind soltas, repetidas em ~18 telas. Foi
  a origem da regressão de contraste no tema claro (já corrigida via variáveis).
- Estética e minimalismo (3/4): tonalidade azul/ouro está sólida, porém quase toda
  seção vem embrulhada em card. "Form num card + lista num card" repetido página após
  página dilui a hierarquia e lê como template.
- Prevenção de erro (2/4): exclusões usam `window.confirm`; várias formas sem validação
  inline; mensagens de erro genéricas ("Erro ao salvar.").
- Flexibilidade e eficiência (2/4): público diário (tesoureiro) sem atalhos de teclado,
  sem paleta de comandos, sem ações em lote além de cobranças; sidebar fixa ocupa
  largura mesmo para quem já decorou o caminho.
- Status do sistema (3/4): a migração para Server Components removeu skeletons; o
  `router.refresh()` pós-mutação não tem indicador de "processando". Pequena regressão.

Absolute bans (varredura): limpos os dois piores. Sem texto em gradiente
(`bg-clip-text`) e sem borda lateral colorida como acento (side-stripe). Pendências
menores: (a) glassmorphism decorativo nos cards de `onboarding` e `trocar-senha`
(`backdrop-blur` sobre fundo quase sólido); no `login` o glass é aceitável por estar
sobre a foto egípcia; (b) sombras adicionadas ao `Card` na unificação de tonalidade
contradizem o DESIGN.md ("Sem sombras"; o contraste de tom já faz a elevação no
escuro).


2. O que está forte (preservar)
-------------------------------

- Tokens e tema: paleta egípcia bem definida, tema claro/escuro token-aware, e a
  legibilidade dos alertas no claro já resolvida por override das variáveis de cor do
  Tailwind (rose/amber/emerald/sky 100-300 escurecidos em `[data-theme=light]` e no
  "system" claro). Não refazer.
- Tonalidade unificada: utilities `bg-sigma-app` / `bg-sigma-card` /
  `bg-sigma-card-elevated`; cards e fundo compartilham o degradê azul (frame quase
  imperceptível). Boa decisão, manter.
- Vocabulário do domínio: "Irmãos", "veneralato", "Tronco de Solidariedade",
  "Saldo dos Irmãos". Casa com o mundo real do usuário (heurística 2 forte).
- Login: pico emocional. Cinematográfico, premium, sobre a foto egípcia. Único lugar
  onde o glass se justifica.


3. O que está fraco (prioridades)
---------------------------------

P1. Card por toda parte (monotonia / hierarquia). Quase toda tela é "card de formulário
    + card de lista". Lei de design: card é a resposta preguiçosa; não embrulhe tudo
    num container. Custo: hierarquia plana, sensação de template, mais ruído.
    Direção: reservar card para agrupamento real (uma entidade, um bloco coeso); usar
    espaçamento e divisores finos para o resto; títulos de seção sem moldura. Cards
    aninhados são sempre erro (conferir páginas com card dentro de card).

P1. Alertas como utilitário solto (consistência / regressão). Banners de status,
    mensagens e erros são classes Tailwind inline em ~18 telas. Frágil e foi o que
    quebrou no tema claro. Direção: componente `ui/alert.tsx` com intents
    (`danger | warn | ok | info`), uma só fonte de cor/contraste, e migrar os banners
    inline para ele. Mata a dívida na raiz.

P2. Feedback de carregamento pós-RSC (status do sistema). Sem skeleton e sem pending no
    `router.refresh()`. Direção: `useTransition` nas mutações dos client components
    para um indicador discreto de "salvando/atualizando"; opcionalmente `loading.tsx`
    por rota para a carga inicial do Server Component.

P2. Tema claro, acabamento que falta (acessibilidade). Os alertas já estão legíveis,
    mas tabelas (zebra/separadores) somem no pergaminho e a borda de card está fraca.
    Direção: subir a borda de card de 6% para ~12% no claro; separador de linha de
    tabela com tom de tinta (não branco translúcido); cabeçalho de tabela com
    superfície + linha inferior fina. Tudo escopado a `[data-theme=light]`/"system".

P2. Glassmorphism e sombras fora do sistema (consistência). Alinhar ao DESIGN.md:
    remover o `backdrop-blur` decorativo de `onboarding` e `trocar-senha` (manter só no
    `login`); reavaliar as `shadow-[...]` do `Card` (no escuro a elevação vem do tom,
    não de sombra).

P3. Eficiência para o uso diário (flexibilidade). O tesoureiro entra todo dia para
    lançar/baixar/cobrar. Direção (futuro): atalhos de teclado para ações frequentes,
    paleta de comandos (Ctrl/Cmd+K) para navegar e agir, e foco automático no primeiro
    campo dos formulários recorrentes.


4. Navegação lateral: a decisão central (revisada)
--------------------------------------------------

O documento anterior propunha sidebar "collapsed por padrão + expandir no hover". A
crítica de produto contraindica isso como decisão padrão:

- Reinventa um padrão de navegação por estética. No registro Product, "padrões de
  navegação são features; não reinvente por sabor".
- Hover-expand gera jank: ao empurrar o conteúdo, qualquer passagem acidental do mouse
  causa reflow e perda de posição de scroll.
- Acessibilidade: nav só-ícone revelada por hover é hostil a teclado e leitor de tela,
  e exige tooltips em ~18 itens.
- Falta um set de ícones distintos por item (hoje usamos bolinhas), coerente com a
  marca dourada. Projeto de design à parte, não orçado.

Implementado (2026-06-30), substituindo o hover-expand:

- Ícones: família **Lucide** (`lucide-react`), 1 por destino (mapa `NAV_ICONS` por href),
  18px / stroke 1.75, item ativo em ouro. Substituiu as bolinhas.
- Sidebar **fixa** no desktop (`lg:sticky lg:top-0 lg:h-screen`): só o conteúdo rola.
- **Rail colapsável** por toggle persistente (`sigma.sidebar.rail`): expandido (w-72) ou
  recolhido só-ícone (`lg:w-16`) com tooltip; botão "Recolher menu" no rodapé. Sem jank.
- **Acordeão single-open**: abrir uma categoria fecha a anterior; a categoria da rota
  atual abre por padrão (`activeCategory`). Trocou o modelo multi-aberto (que poluía).
- Mobile: drawer full com overlay (rail/acordeão não afetam o mobile).
- Atalho de busca: paleta de comandos `Ctrl/Cmd+K` (`command-palette.tsx`) cobre o acesso
  rápido a qualquer tela, então o acordeão não precisa manter várias categorias abertas.
- Hover-expand fica como refinamento opcional futuro (via overlay, sem push).


5. Cards, tabelas e tipografia
------------------------------

- Cards: manter `bg-sigma-card` / `bg-sigma-card-elevated`. Aplicar disciplina (item
  P1): nem toda seção é card. Borda de card 6% no escuro; ~12% no claro.
- Elevação por camadas (manter): 0 fundo, 1 card, 2 elevado (dropdown/modal), 3 overlay.
  No escuro, elevação por tom, sem sombra.
- Tabelas: cabeçalho com superfície + linha inferior fina; linhas 36-44px; separador de
  linha visível nos dois temas; badges de status como semáforo (recebido/pendente/
  vencido/emitido) usando o `Badge` existente.
- Tipografia: manter a escala atual e a fonte Geist única no produto. Não divergir peso
  de heading por tema (o ajuste "H2 mais leve só no claro" do doc anterior foi
  descartado: gera inconsistência entre temas para ganho marginal).
- Motion: 150-250ms ease-out em hover e transição de layout; zoom só em ícone, nunca em
  bloco de dados; sem bounce/elastic; nunca animar largura/altura de conteúdo.


6. Plano em duas ondas (por risco x valor)
------------------------------------------

Onda 1 (baixo risco, alto valor; fazer primeiro):
1. `ui/alert.tsx` semântico (intents) e migração dos banners inline para ele.
2. Tema claro: borda de card 6% para 12%, separadores de tabela com tom de tinta,
   cabeçalho de tabela com superfície + linha.
3. Feedback pós-RSC: `useTransition` nas mutações (pending discreto).
4. Alinhar glass/sombra ao DESIGN.md (remover blur decorativo de onboarding/trocar-senha;
   reavaliar sombras do Card).

Onda 2 (repensar / mais esforço; depois):
5. Navegação: toggle persistente de colapso (não hover-expand). Definir ícones antes.
6. Disciplina de cards: revisar página a página, remover containers desnecessários,
   eliminar qualquer card aninhado.
7. Eficiência: atalhos de teclado e paleta de comandos para o uso diário.

Onda 2+ (opcional, refinamento):
8. Hover-expand da sidebar como overlay (sem push), só depois do toggle estável.


7. Checklist de implementação
-----------------------------

[x] `ui/alert.tsx` com 4 intents + substituir banners inline (layout + 11 telas).
[x] `globals.css` tema claro: borda de card/tabela em tinta escura (legível no pergaminho).
[x] Remover `backdrop-blur` de onboarding/trocar-senha; remover `shadow` do Card.
[x] Paleta de comandos (Ctrl/Cmd+K) para navegar e buscar telas (eficiência diária).
[x] Sidebar: ícones Lucide por item + fixa no desktop (sticky) + rail colapsável
    (só-ícone, toggle persistente, tooltips). Mobile drawer inalterado. (2026-06-30)
[x] Menu acordeão single-open (abrir uma fecha a anterior; abre a categoria da rota
    atual por padrão). Trocou o multi-aberto. (2026-06-30)
[x] Seta "Voltar" (`router.back`) no manual, que usa o layout institucional. (2026-06-30)
[x] Manual do usuário (v1.2): cap. 4 documenta ícones, menu fixo/recolhível, acordeão,
    busca `Ctrl/Cmd+K` e tema (Escuro/Claro/Sistema). (2026-06-30)
[x] ConfirmDialog do design system (`ui/confirm-dialog.tsx`, ConfirmProvider + `useConfirm`
    → `askConfirm`) substituiu os 10 `window.confirm` (intents default/danger). Nome
    distinto + verificação (0 sem `await`) mitigaram o risco do refactor assíncrono. (2026-07-01)
[ ] (Backlog) `useTransition` para indicador de "atualizando" no `router.refresh()`.
    Hoje os estados de botão ("Salvando…") + a paleta já dão feedback; ganho marginal.
[ ] (Backlog) Auditoria de cards: remover containers redundantes; zero cards aninhados.
    Subjetivo, precisa de iteração visual no navegador.
[ ] (Backlog) Validação inline nos formulários (maior alavanca de prevenção de erro).

Histórico: a versão anterior tratava o hover-expand da sidebar como decisão central; a
crítica de produto recomendou priorizar o componente de alerta e o acabamento do tema
claro e trocar o hover-expand por toggle de colapso. Entregue em 2026-06-30: Onda 1
(alerta, tema claro, glass/sombra), paleta de comandos, **sidebar completa** (ícones
Lucide + fixa + rail colapsável + acordeão single-open), seta de voltar no manual e o
**manual v1.2** documentando temas e menus. Estimativa de saúde após estas mudanças:
~34-36/40. Restam (precisam de iteração visual / decisão): confirm dialog em ações
destrutivas, validação inline nos formulários, auditoria de cards (containers
redundantes). Chegar a 38-40 depende desses itens + teste de usabilidade real.


8. Aferição (impeccable critique, 2026-09-16)
----------------------------------------------

Registro: Product. Método dual-agent (revisão de design isolada + scanner mecânico
`impeccable detect` + evidência de navegador nas páginas públicas — o dashboard exige
login contra o banco de produção, fora do escopo seguro de uma inspeção automatizada).
Relatório completo arquivado em
`.impeccable/critique/2026-09-16T08-19-37Z__src-app-dashboard-experi-ncia-geral-do-painel.md`.

Escopo bem mais amplo que o de 30/06 (que olhou principalmente chrome/tema): desta vez
cobriu o corpo das telas — Membros, Contas, Pagamentos, Cadastros mestre, Configurações,
Transferências e Materiais (as duas últimas lançadas no mesmo dia da crítica), e o
Portal do obreiro. **Não é uma regressão da nota anterior** — são pontos cegos
diferentes: 30/06 avaliou moldura/tema (que segue sólida); esta rodada avaliou
consistência de interação dentro das telas, e aí a dívida estava.

Saúde do design (heurísticas de Nielsen, leitura honesta): **19/40**, faixa "Fraco".
Nenhuma heurística é N/A (produto completo de admin + autoatendimento). Pontos que
puxam a nota:

- Consistência (1/4): Cadastros mestre bifurcou o design system no mesmo arquivo que
  usa os componentes certos (`CollapsibleCard` local, `INPUT`/`ADD_BTN` como classe
  solta, edição via `document.getElementById` em vez de estado controlado).
- Prevenção de erro (1/4): excluir conta financeira, aprovar/rejeitar transferência
  entre contas e marcar material como extraviado disparam em um clique, sem `useConfirm`
  — inclusive nas duas features novas do dia (Transferências, Materiais), apesar do
  `ConfirmProvider` já estar montado globalmente e usado em 10 outros arquivos.
- Ajudar a reconhecer/corrigir erros (1/4): `membros/page.tsx` e `portal/page.tsx` não
  têm `try/catch` nas chamadas de carga — um 500 do servidor deixa "Carregando..." pra
  sempre, sem erro, sem retry.
- Status do sistema (2/4): sucesso e erro renderizam como o *mesmo* `Alert
  intent="warn"` em Membros e Cadastros — uma mensagem de sucesso aparece amarela.
- Correspondência com o mundo real (2/4): o Portal do obreiro rotula o que ele **deve**
  como "A receber" — linguagem do tesoureiro, entregue à única audiência do produto sem
  letramento contábil.

Achado de especificidade (o mais barato de corrigir, o de maior alavanca): o
`DESIGN.md` (seção "Empty states", linha ~326) documenta há meses uma voz cerimonial
por ofício para telas vazias — *"Tesouraria: Nenhum lançamento. O Livro está limpo."* —
e nenhuma das quatro frases existe no código. As 16 telas com estado vazio usam o
genérico "Nenhum(a) [substantivo] cadastrado". Zero risco visual, maior racionamento de
autoria pendente no produto.

Achado urgente, já corrigido no mesmo dia: `Pagamentos` passou a exigir
`bankAccountId` (feature do dia), mas `Cadastros mestre` — única tela que cria
`FinancialAccount` — tinha `roles: ['admin','venerable','secretary']`, sem
`'treasurer'`. O Tesoureiro ficava sem rota navegável (nem menu, nem ⌘K) pra criar a
conta que o próprio Pagamentos exige. **Corrigido** (`layout.tsx`, commit `b50ea8b`) —
o backend já permitia (`treasurer` tem `accounts:write`), só faltava o menu.


9. Prioridades da aferição de 2026-09-16 (backlog de polimento)
-----------------------------------------------------------------

P0. [x] Tesoureiro sem rota até Cadastros mestre (bloqueava a tarefa mais frequente do
    produto). Corrigido: `treasurer` adicionado aos `roles` de `/dashboard/cadastros`.

P1. [x] Confirmação em ações destrutivas/financeiras que ainda não passaram pelo
    `useConfirm`. Corrigido (2026-09-16): `ContasClient.tsx` (excluir conta, com o
    título/valor no diálogo), `TransferenciasClient.tsx` (aprovar/rejeitar transferência,
    reapresentando `de/para/valor` no diálogo), `MaterialsClient.tsx` (marcar extraviado,
    nomeando material/quantidade/membro), `CadastrosClient.tsx` (backfill em massa de
    contas ao plano). Mesmo padrão de `PagamentosClient.tsx` (`askConfirm` nomeando a
    consequência).

P1. [x] Feedback de sucesso/erro inconsistente e mutações silenciosas. Corrigido
    (2026-09-16): `membros/page.tsx` e `CadastrosClient.tsx` agora usam o shape
    `{kind:'ok'|'error'}` (mesmo de `ContasClient.tsx`) em toda mutação, com `response.ok`
    checado nas ~10 mutações de `CadastrosClient` que antes eram silenciosas.
    `ConfiguracoesClient.tsx` trocou a `<div>` crua pelo `<Alert>` já importado (recupera
    o override de contraste do Papiro e o `role` de acessibilidade). `membros/page.tsx` e
    `portal/page.tsx` ganharam `try/catch` + `finally { setLoading(false) }` no
    carregamento, com `Alert` de erro + botão "Tentar de novo" (antes, um 500 travava
    "Carregando..." pra sempre).

P2. [ ] Voz cerimonial dos estados vazios (DESIGN.md já escrita, nunca implementada).
    Trocar os 16 `EmptyState` de "Nenhum(a) X cadastrado" pelas frases por ofício já
    documentadas (Tesouraria, Hospitalaria, Secretaria, Chancelaria) + escrever as que
    faltam pros módulos novos (Materiais, Transferências).

P2. [ ] Cadastros mestre: escopo e dono. Cinco domínios não relacionados numa página
    (Ritos/Potências — Secretaria; Plano de contas/Clientes-fornecedores/Contas
    bancárias — Tesouraria) é provavelmente por isso que a página bifurcou os padrões
    do design system. Direção: promover "Contas bancárias e Caixa" (e possivelmente
    Plano de contas/Clientes-fornecedores) para itens próprios em Financeiro; refatorar
    o que sobrar de Cadastros mestre pra usar `CollapsibleCard`/`inputClass`/`Button`
    do design system em vez das cópias locais.

P2. [ ] Formulários longos sem aviso de alteração não salva nem scroll até o feedback.
    `ConfiguracoesClient.tsx`: mensagem no topo, botão Salvar ~1300px abaixo, sem
    scroll automático (o padrão `notify()` de `membros/page.tsx` resolve isso mas só
    foi aplicado em 2 dos 4 pontos daquele mesmo arquivo). `seedOffices()` salva o
    formulário inteiro sem avisar, antes de semear cargos.

P2. [ ] Acessibilidade de formulário: `placeholder` como único rótulo é o padrão
    dominante (Contas, Pagamentos, Transferências, Materiais, parte de Membros);
    `htmlFor` só existe em `ui/input.tsx`. `aria-expanded` aparece uma única vez em
    todo o dashboard — nenhum `CollapsibleCard`, acordeão da sidebar ou linha expansível
    de Membros anuncia estado pra leitor de tela.

P3. [ ] Portal do obreiro fala a língua errada pra audiência errada. "A receber"/"A
    pagar" são sinais do livro-caixa da loja, entregues ao membro que é o outro lado
    do lançamento — pra ele, "A receber: R$ 450,00" lê como dinheiro vindo, quando é
    dívida dele. Card financeiro também não tem gate de `loading` (mostra R$ 0,00 antes
    do valor real). Direção: rótulos do ponto de vista do obreiro ("O que devo" / "O
    que já paguei" / "Pendências"), gate de loading no card, "Meu extrato" aberto por
    padrão (é o motivo dele estar ali).

P3. [ ] Moeda em dois formatos. 19 pontos usam `.toFixed(2)` ("R$ 1250.00", inclusive no
    extrato impresso do obreiro em `portal/page.tsx`); 12 usam
    `toLocaleString('pt-BR', {style:'currency'})` correto. Extrair um `brl()` único
    (já existe, duplicado, em 4 arquivos) e trocar os 19 pontos. Enquanto mexer,
    aplicar `font-mono` nos valores por DESIGN.md (hoje só usado no hint do ⌘K).

P3. [ ] Landing: contraste de texto sépia (`#2D281E`) sobre seções escuras mede 1.2:1
    (mínimo 4.5:1) — a cor foi pensada pro fundo papiro dos cards de plano
    (`rgba(245,237,214,0.60)`), não pra seções sem esse fundo. Conferir visualmente
    onde esse par de cores aparece fora do card de papiro. (Achados de `kicker-above-
    heading`, `dark-glow` e "geist 78% do texto" no mesmo scan foram lidos como
    prováveis falsos positivos — já documentados como decisão intencional no histórico
    do projeto — e não entram neste backlog.)

P3. [ ] `/manual` tem dois `<h1>` na mesma página (achado da varredura de DOM);
    `/manual` e `/sobre` não têm marco `<main>`. Ajuste pontual de semântica, sem
    risco visual.

Fora do backlog (observações registradas, não priorizadas por ora): toggle de tema só
alcançável pelo Admin (Configurações é `roles:['admin']` — os outros 5 papéis não
trocam de tema); `art002-alert.tsx` é a única superfície com `box-shadow`/`text-white`
do dashboard, contra as próprias regras do DESIGN.md; sistema de toast especificado no
DESIGN.md nunca foi construído (todo erro hoje é `Alert` inline); `Badge` usado em só
3 de ~70 arquivos do dashboard, resto reinventa badge com classes soltas; tabelas do
relatório de Fechamento sem `overflow-x-auto` (podem estourar em 400px).
