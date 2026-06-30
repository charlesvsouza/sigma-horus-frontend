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
[ ] (Adiado, risco) Confirm dialog substituindo `window.confirm`. O refactor assíncrono
    em ações destrutivas (excluir membro, encerrar veneralato) é perigoso às cegas: um
    `await` esquecido remove a confirmação silenciosamente. Fazer só com iteração visual.
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
