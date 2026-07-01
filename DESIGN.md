# Sigma Horus — Design System

## Marca e Conceito

O nome Sigma Horus remete ao Olho de Hórus, símbolo egípcio de proteção e visão. As
pirâmides de Gizé representam a solidez milenar, a precisão arquitetônica e a
grandiosidade — valores que o sistema traz para a gestão financeira de lojas
maçônicas.

"**A tesouraria da sua loja no prumo**" — precisão egípcia, solidez maçônica.

### Marca oficial (logo)

A marca é o **emblema ouro** — Olho de Hórus integrado a esquadro e compasso, com o
wordmark "SIGMA HORUS" abaixo. Substitui o antigo Olho de Hórus desenhado em SVG.

| Asset | Arquivo | Uso |
|-------|---------|-----|
| Logo completo (emblema + wordmark) | `public/sigmahorus_ouro.png` | Landing (nav, hero, conceito, rodapé), login |
| Logo preto | `public/sigmahorus_preto.png` | Fundos claros / impressão |
| Emblema (sem wordmark) | `src/app/icon.png` | Favicon, app icon, marca compacta (sidebar, card mobile) |
| Favicon | `src/app/favicon.ico` | Aba do navegador (gerado do emblema) |
| OG / share | `src/app/opengraph-image.png` | Compartilhamento (foto egípcia + logo, 1200×630) |

Fundo de marca (landing/login): foto egípcia `public/backgraund_theme.png` com véu
azul-noite (`blue-deep` 55–95% de opacidade), mais denso onde há texto.

## Registro

**Product** (app UI, dashboard, ferramenta de gestão). O design serve ao produto: clareza
de dados financeiros, eficiência operacional, confiança institucional.

## Paleta de Cores

### Tokens

| Token | Hex | Uso |
|-------|-----|-----|
| `--sigma-blue-deep` | `#0A1628` | Fundo principal — profundidade do céu noturno egípcio |
| `--sigma-blue-dark` | `#0B1A2E` | Superfícies elevadas, sidebar, cards |
| `--sigma-blue-mid` | `#1E3A5F` | Superfícies elevadas (hover, modais) |
| `--sigma-gold` | `#C9A227` | Acento primário — ouro do deserto ao pôr do sol |
| `--sigma-gold-light` | `#D4AF37` | Hover, brilho |
| `--sigma-gold-dark` | `#A08020` | Estados pressionados |
| `--sigma-sand` | `#E6D5B8` | Texto corpo — areia do deserto |
| `--sigma-sand-light` | `#F2E8D5` | Títulos, texto enfatizado — papiro iluminado |
| `--sigma-sand-dark` | `#C4B49A` | Texto secundário, desabilitado |

### Estratégia de cor

**Regra do Ourives:** o ouro é precioso porque é raro. Aparece apenas em:
1. CTAs primários (Começar, Salvar, Criar)
2. Estado ativo (sidebar, breadcrumb final)
3. Nome da loja no cabeçalho
4. **Fio de Prumo** — uma única linha dourada por página entre cabeçalho e conteúdo

O fundo escuro (blue-deep) domina com ~70%. A areia texturiza o restante. A paleta
inteira evoca deserto ao entardecer + céu noturno.

### Tema Papiro (claro)

O tema claro não é um mero inverso — é uma experiência própria:

| Token | Escuro (noite) | Papiro (claro) |
|-------|----------------|----------------|
| Fundo página | `#0A1628` (azul profundo) | `#F5F0E8` (papiro envelhecido) |
| Cards | `#0B1A2E` | `#EDE7DB` (tom sobre tom) |
| Texto principal | `#F2E8D5` (areia iluminada) | `#2D281E` (sépia escuro) |
| Ouro | `#C9A227` | `#B8860B` (ouro antigo) |

No Papiro, as bordas `border-white/x` são convertidas para tinta sépia escura via
override no `globals.css`, mantendo a arquitetura de tokens sem duplicar componentes.

### Feedback

| Estado | Cor | Contexto |
|--------|-----|----------|
| Sucesso | Verde quente (esmeralda) | Pagamentos, contas pagas |
| Erro | Rosa queimado | Vencido, erro, deleção |
| Alerta | Ouro + âmbar | Pendente, atenção |
| Info | Azul médio | Neutro, informativo |

### Regras

- Nunca usar `#000` ou `#fff`. Neutros sempre tintados com o matiz da marca.
- Overlay de imagem: gradiente linear escuro (blue-deep com 75-90% de opacidade nas
  bordas, 40-50% no centro).

## Tipografia

**Duas vozes:** contraste entre solidez atemporal (Cinzel) e precisão moderna (Geist).

| Nível | Fonte | Tamanho | Peso | Uso |
|-------|-------|---------|------|-----|
| Display | **Cinzel** (serifa inscricional) | 3xl-4xl (30-36px) | Bold | Título de página (dashboard + landing) |
| Heading 1 | Cinzel | 2xl (24px) | Semibold | Seções principais da landing |
| Heading 2 | Geist | xl (20px) | Semibold | Subseções (dashboard) |
| Body | Geist | base (16px) | Normal | Conteúdo principal |
| Body small | Geist | sm (14px) | Normal | Metadados, labels |
| Caption | Geist | xs (12px) | Normal | Auxiliar, badges |
| Mono | Geist Mono | sm (14px) | Normal | Valores financeiros, código |

- Cinzel evoca pedra gravada de templo — usada com moderação: landing, nome da loja no header, títulos de página.
- Geist responde pelo corpo, UI e dados — a face utilitária e legível.
- Body line length: 65-75ch
- Escala com proporção 1.25 entre níveis

## Espaçamento e Ritmo

| Token | Valor | Uso |
|-------|-------|-----|
| `--space-xs` | 4px | Ícones, gaps internos |
| `--space-sm` | 8px | Entre elementos relacionados |
| `--space-md` | 16px | Padding de cards, entre grupos |
| `--space-lg` | 24px | Entre seções, padding de página |
| `--space-xl` | 40px | Seções maiores |
| `--space-2xl` | 64px | Quebras de página |

- Ritmo variado — mesmo padding em todo lugar é monotonia.
- Cards e tabelas usam padding interno de 16-20px.

## Elevação e Superfícies

| Nível | Classe | Uso |
|-------|--------|-----|
| 0 | Fundo (blue-deep) | Body, página |
| 1 | Card (blue-dark 80%, border white/6%) | Cards, form sections |
| 2 | Elevated (blue-mid 70%, border white/10%) | Modais, dropdowns |
| 3 | Overlay (blue-deep 80%, backdrop-blur) | Drawers, modais fundo |

- Cantos: `rounded-xl` (12px) para cards maiores, `rounded-lg` (8px) para internos,
  `rounded-full` para badges e CTAs.
- Borda sutil: `border` com `border-white/[6-10%]`.
- Sem sombras — dark mode não precisa de box-shadow, o contraste de tom já faz a
  elevação.

## Componentes

### Botões

| Variante | Fundo | Texto | Hover |
|----------|-------|-------|-------|
| Primary | gold | blue-deep | gold-light |
| Secondary | blue-mid /40% | sand-light | blue-mid /60% |
| Ghost | transparent | sand | white/10% bg |
| Danger | rose/15% | rose-300 | rose/25% |

- Shape: `rounded-full` ou `rounded-lg` (consistente por contexto).
- Padding: `px-5 py-2.5` (md), `px-4 py-2` (sm).
- Transição: ease-out-expo 200ms em bg e opacity.

### Inputs

- Fundo: `rgba(10, 22, 40, 0.6)` (blue-deep 60%)
- Borda: `rgba(255, 255, 255, 0.08)` → focus gold
- Texto: sand-light
- Placeholder: sand-dark
- Focus: ring gold 2px com 20% opacidade
- Erro: ring rosa + borda rosa
- Shape: `rounded-lg` (8px)

### Badges / Status

| Variante | Fundo | Texto | Borda |
|----------|-------|-------|-------|
| Paid / Recebido | emerald/15% | emerald-300 | emerald/20% |
| Pending / Pendente | gold/12% | gold | gold/15% |
| Overdue / Vencido | rose/12% | rose-300 | rose/15% |
| Billed / Emitido | sky/12% | sky-200 | sky/15% |
| Canceled | white/8% | sand-dark | white/10% |

- Shape: `rounded-full`, padding `px-2.5 py-0.5`, font `xs` medium.
- Dot indicador opcional: bolinha 6x6 com mesma cor antes do texto.

### Tabelas

- Header: sand-dark, xs uppercase semibold
- Body: sand regular sm
- Hover row: white/3% overlay
- Border entre linhas: white/5%
- Padding cell: `px-4 py-3`
- No tema claro, `border-white/x` vira tinta escura (sand-light) via override em
  `globals.css`, senão a linha some no pergaminho.

### Alertas / avisos (`ui/alert.tsx`)

- Sempre via `<Alert intent>`, nunca classes Tailwind soltas (evita regressão de
  contraste). Intents: `info` (sky), `ok` (emerald), `warn` (amber), `danger` (rose).
- Variantes: `card` (arredondado, mensagens de tela) e `banner` (faixa de topo, ex.:
  aviso de assinatura no layout).
- `role="alert"` para warn/danger, `role="status"` para info/ok.
- No tema claro, o texto dos tons de alerta é escurecido (700/800) por override das
  variáveis de cor do Tailwind em `globals.css` (cobre base e opacidade).

### Cards

- Fundo: degradê `bg-sigma-card` (blue-mid→blue-dark) / `bg-sigma-card-elevated`.
- Borda: white/6% (escuro); tinta escura ~12% no claro.
- Padding: `p-5`; Shape: `rounded-xl` (12px).
- Sem sombra: a elevação vem do tom (degradê + borda), não de box-shadow.
- Disciplina: nem toda seção é card. Reservar para agrupamento real; nunca aninhar.

### Navegação rápida

- Paleta de comandos `Ctrl/Cmd+K` (`command-palette.tsx`): busca e navega telas por
  teclado (setas/enter/esc). Botão "Buscar ⌘K" no cabeçalho do dashboard.

### Sidebar (`DashboardShell.tsx`)

- Ícones: **Lucide** (`lucide-react`), 1 por destino (mapa `NAV_ICONS` por href),
  18px, stroke 1.75 (consistente com os SVGs inline). Ativo em ouro.
- Fixa no desktop (`lg:sticky lg:top-0 lg:h-screen`); só o conteúdo principal rola.
- **Rail colapsável** (desktop): toggle persistente (`sigma.sidebar.rail`), `lg:w-16`
  só-ícone com tooltips; esconde wordmark/labels/headers de categoria (`lg:`). Mobile
  permanece como drawer full com overlay (rail não afeta o mobile).
- **Acordeão single-open**: uma categoria aberta por vez (abrir uma fecha a anterior);
  por padrão abre a categoria da rota atual (`activeCategory`).
- Item ativo destacado em ouro. Ícone também em ouro no item ativo.

## Estados

### Loading

- Skeleton loader por bloco (não spinner genérico)
- Animação: pulse com gradiente (blue-mid 40% → blue-mid 60% → blue-mid 40%)
- Shape arredondado correspondente ao conteúdo que substitui

### Empty

- Ícone/ilustração grande e sutil (opacidade 30-40%)
- Texto descritivo sand-dark
- CTA primário para ação relevante
- Margem vertical generosa (py-20+)

### Erro

- Toast no canto superior direito
- Fundo rose/15%, borda rose/20%, texto rose-200
- Ícone de alerta
- Auto-dismiss em 5s ou clique

## Animações

- Transições de layout/hover: ease-out-expo 200-300ms
- Entrada de elementos: fade-in + translateY(4px) 300ms ease-out
- Sidebar collapse: width 300ms ease-out
- Modal/Drawer: fade + scale 200ms ease-out
- Sem bounce, sem elastic, sem animar propriedades CSS layout (width/height/top/left)

### Movimento orquestrado

- **Reveal (`animate-reveal`):** elementos entram com fade+translate ao entrar no
  viewport (IntersectionObserver). Usado em seções da landing e blocos do dashboard.
- **Stagger (`animate-stagger`):** cascata com delay progressivo controlado por
  `style="--i:N"`. Cards do dashboard entram em sequência — a tesouraria primeiro,
  depois os demais ofícios.
- **Cerimonial (`animate-rise`):** reservado para o hero da landing — entrada solene
  com `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Prefers-reduced-motion:** todas as animações respeitam a preferência do SO.

## Assinaturas

### Fio de Prumo

A única linha dourada por página. Inspirada no fio de prumo do arquiteto — o
instrumento que aprova o que está reto. Aparece como separador entre o cabeçalho
e o conteúdo em cada tela do dashboard.

```css
.fio-de-prumo {
  height: 1px;
  background: linear-gradient(
    90deg, transparent 0%, var(--sigma-gold) 20%,
    var(--sigma-gold) 80%, transparent 100%
  );
  opacity: 0.4;
}
```

Classe global em `globals.css`. Posicionada no DashboardShell entre o `<header>`
e `<main>`, exatamente antes do `bg-sigma-app`.

### Empty states

Cada ofício tem sua própria voz quando vazio:
- **Tesouraria:** "Nenhum lançamento. O Livro está limpo."
- **Hospitalaria:** "Nenhuma campanha de benemerência. Que tal semear a primeira?"
- **Secretaria:** "Nenhum membro cadastrado. A Loja espera seu quadro."
- **Chancelaria:** "Nenhum documento. O arquivo aguarda."

Os textos substituem o genérico "Nada aqui ainda", dando personalidade à primeira
experiência de cada módulo.
