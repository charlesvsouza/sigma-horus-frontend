Design Refinado — Sigma Horus
==============================

Propósito: consolidar a análise do estado atual, referências de mercado (ERPs modernos como SAP S/4HANA Fiori, Oracle NetSuite, Microsoft Dynamics, Linear, Stripe Dashboard) e diretrizes refinadas para modelar a interface do Sigma Horus, alinhadas à marca egípcia e a boas práticas de legibilidade, densidade de informação e acessibilidade.


1. Cenário atual — ponto de partida
-----------------------------------

- Paleta: tokens já bem definidos (blue-deep/blue-dark/blue-mid + gold + sand), com sistema de tema claro/escuro token-aware em `globals.css`.
- Tema claro atual: baseado em `#E7E1D2` (pergaminho). Aplicação está funcional, mas há pontos críticos:
  - avisos/alertas: textos em tons claros (`rose-200/300`, `amber-200/300`, `emerald-200/300`, `sky-200/300`) perdem contraste no fundo claro; já existe override parcial em `globals.css`.
  - modais/drawers/cards: boa elevação, mas contraste de borda pode ser reforçado para WCAG AA no pergaminho.
  - tabelas: zebra/linhas separadoras quase invisíveis no tema claro.
- Componentes principais:
  - `Card` (`ui/card.tsx`): já usa `bg-sigma-card` e `bg-sigma-card-elevated` (tema-aware). Fortes pontos.
  - `Badge` (`ui/badge.tsx`): bom padrão; precisa garantir no tema claro que as variantes continuem com contraste AA (já há tendência a tokens de ouro/verde, que podem precisar de ajuste de opacidade).
- Sidebar (`DashboardShell.tsx`): estado fixo expandido em desktop, menu mobile abre/fecha com overlay; **ainda não** está recolhida por padrão nem faz hover “só ícone → expandir para a direita”.


2. Padrões observados em ERPs modernos
---------------------------------------

São 4 eixos recorrentes nos produtos de referência:

2.1 Layout e densidade
- “Mais dados por tela” com hierarquia clara: pouco whitespace, subtítulos calibrados, separadores sutis.
- Uso intenso de cartões e tabelas compactas.
- Atalhos globais via sidebar fixa e breadcrumb visível; pouca dependência de menus suspensos.

2.2 Navegação lateral
- SAP Fiori, Oracle NetSuite, Odoo e Linearity adotam menu lateral recolhido em ```collapsed``` padrão no desktop.
- Comportamento no hover/expand:
  - Estado collapsed: apenas ícone (largura ~56–68px), labels ocultas, tooltips opcionais.
  - Estado expandido: largura 240–320px, aparece label principal; submenus, se existirem, abrem como flyout/lateral integrada à própria barra, não dentro da área principal.
  - Transição: width 200–300ms, cubic-bezier suave (ease-out-expo/out-circ).
- Importante: quando a barra expande, o conteúdo principal pode ser “achatado” para a esquerda (empurrar) ou sobreposto (overlay). ERPs enterprise preferem “empurrar” para manter o fluxo sem perda de contexto.

2.3 Cards e hierarquia
- Sistema de elevação por camadas (nível 0 = fundo, nível 1 = card, nível 2 = elevado (dropdown/modal), nível 3 = overlay).
- Cards com micro-interação: hover sutil (borda dourada no Sigma Horus), sem animações pesadas.
- Títulos e KPIs devem ter proporção visual 1:2:4 (label, valor, delta) em métricas.

2.4 Tabelas
- Cabeçalho com fundo superfície + separador fino inferior.
- Linhas com altura aproximada 36–44px.
- Badges de status operando como semáforo (paid=pending=em andamento, overdue=atenção, billed=informativo).


3. Diretrizes refinadas para o Sigma Horus
------------------------------------------

3.1 Sidebar collapsible com hover
- Estado padrão desktop: collapsed (só ícone), largura 60px.
- Hover do mouse na área da sidebar: expandir para 260px, transição 250ms ease-out.
- Submenus (grupos de navegação): exibir como coluna abaixo do item pai na própria barra, alinhada à esquerda, sem overwrite do conteúdo principal.
- Touch/dispositivos sem hover: botão toggle fixo (já existente no app) para expandir/colapsar.
- Regra: label e breadcrumb continuam funcionais no estado expandido; quando collapsed, só ícone ativo é destacado em gold.

3.2 Cards e painéis
- Sólida a atual estratégia de ```bg-sigma-card``` e ```bg-sigma-card-elevated``` — manter.
- No tema claro, reforçar contraste das bordas de card (subir transp. da borda branca de 6% para 12%).
- Manter hover com elevação sutil e foco dourado; não aplicar transformações fortes em toda a tela para não quebrar scroll.

3.3 Tema claro — legibilidade dos avisos/alertas
- Targets a atingir:
  - `text-rose-200/300` → no claro, usar diretamente `#be123c` (rose-700; já mapeado em globals.css, ampliar cobertura).
  - `text-amber-200/300` → `#b45309` (amber-700; já mapeado).
  - `text-emerald-200/300` → `#047857` (emerald-700; já mapeado).
  - `text-sky-200/300` → `#0369a1` (sky-700; já mapeado).
- Todo componente novo de alerta usar semânticas/intents (`.alert-danger`, `.alert-warn`, `.alert-ok`, `.alert-info`) em vez de utilitários Tailwind soltos, para evitar regressão de contraste.

3.4 Tipografia e ritmo
- Seguir a escala atual, mas no tema claro reduzir peso em textos heading 2 (de Semibold para Medium) para evitar densidade excessiva.
- Linha base 16px; tabelas e cards usam padding 16–20px.
- Títulos e labels de seção em tracking amplo (já aplicado no projeto); manter.

3.5 Animações e transições
- Transições de layout (sidebar collapse/expand): 200–250ms ease-out, sem cubic-bezier muito elástico.
- Hover em cards/botões: 150–200ms ease-out, zoom apenas em ícones, não em blocos de dados.
- Respeitar `prefers-reduced-motion` (já existe regra em globals.css; expandir para incluir sidebar).


4. Requisitos funcionais para a sidebar “hover/icon”
----------------------------------------------------

- Quando collapsed:
  - Largura total: 60px
  - Apenas o ícone por item, sem texto.
  - Tooltip (nativo ou próprio) exibindo o label ao pairar.
- Quando expandido por hover:
  - Largura total: 260px
  - Labels e grupos reaparecem progressivamente.
  - Submenus aparecem como lista vertical imediatamente abaixo do item pai (mesmo container da sidebar), alinhados à esquerda da barra.
- Comportamento mobile: menu lateral full com overlay ao clicar no botão hambúrguer (mantendo o atual).
- Foco acessível: Tab/Shift+Tab deve navegar entre os itens; hover não deve roubar foco.


5. Checklist de implementação sugerido
---------------------------------------

1. Refinar `globals.css` para tema claro:
   - Reforçar contraste de bordas de cards e linhas de tabela.
   - Garantir coverage global dos tokens de alerta no claro (extender mapeamento atual).
2. Implementar variantes semânticas de alerta em `ui/alert.tsx` (novo componente).
3. Redesenhar `DashboardShell.tsx`:
   - Estado collapsed por padrão em desktop (>1024px).
   - Comportamento de hover em toda a área da sidebar (desktop).
   - Reorganizar submenus para aparecerem na mesma barra.
4. Criar componente `ui/sidebar-icon-item.tsx` e `ui/sidebar-group.tsx` para encapsular estados active/hover/collapsed/expanded.
5. Ajustar testes e lint para as novas dependências/interações.

Observação: este documento não altera código, apenas consolida as decisões de design que deverão orientar a implementação seguinte. Manter este arquivo como fonte da verdade visual e comportamental do produto.
