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

**Committed**: o gold carrega 20-30% das superfícies de interação (CTAs, indicador
ativo, badges de status). O fundo escuro (blue-deep) domina com ~70%. A areia texturiza
o restante. A paleta inteira evoca deserto ao entardecer + céu noturno.

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

| Nível | Fonte | Tamanho | Peso | Uso |
|-------|-------|---------|------|-----|
| Display | Geist | 3xl-4xl (30-36px) | Bold | Título de página |
| Heading 1 | Geist | 2xl (24px) | Semibold | Seções principais |
| Heading 2 | Geist | xl (20px) | Semibold | Subseções |
| Body | Geist | base (16px) | Normal | Conteúdo principal |
| Body small | Geist | sm (14px) | Normal | Metadados, labels |
| Caption | Geist | xs (12px) | Normal | Auxiliar, badges |
| Mono | Geist Mono | sm (14px) | Normal | Valores financeiros, código |

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

### Cards

- Fundo: blue-dark a 70-80%
- Borda: white/6%
- Padding: `p-5`
- Shape: `rounded-xl` (12px)
- Título: heading2 ou body semibold + cor sand-light

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
