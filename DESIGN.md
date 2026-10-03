---
name: Sigma Horus
description: A tesouraria da sua loja no prumo — precisão egípcia, solidez maçônica.
colors:
  night-deep: "#0A1628"
  night-surface: "#0B1A2E"
  night-raised: "#1E3A5F"
  gold: "#C9A227"
  gold-light: "#D4AF37"
  gold-dark: "#A08020"
  sand: "#E6D5B8"
  sand-light: "#F2E8D5"
  sand-dim: "#C4B49A"
  papyrus-bg: "#F5F0E8"
  papyrus-surface: "#EDE7DB"
  papyrus-raised: "#E2D9CA"
  papyrus-gold: "#B8860B"
  papyrus-ink: "#2D281E"
  papyrus-ink-soft: "#5C5346"
  papyrus-ink-dim: "#7D725E"
  paid-emerald: "#6EE7B7"
  overdue-rose: "#FDA4AF"
  billed-sky: "#BAE6FD"
typography:
  display:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  numeric:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  md: "8px"
  lg: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.night-deep}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.gold-light}"
  button-secondary:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.sand-light}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-danger:
    textColor: "{colors.overdue-rose}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  card:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.sand}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.night-deep}"
    textColor: "{colors.sand-light}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  badge-paid:
    textColor: "{colors.paid-emerald}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: Sigma Horus

> Regenerado em 2026-10-03 a partir do código (`globals.css`, `components/ui/*`, `DashboardShell.tsx`).
> A versão anterior (2026-07-01) está em `.impeccable/backup-2026-10-03/DESIGN.md`.
> Descrições qualitativas (Creative North Star, caráter das cores) foram **derivadas do documento anterior e do código**, não de uma nova entrevista — confirmar com o dono.

## Overview

**Creative North Star: "O Fio de Prumo".** Uma ferramenta de trabalho que se comporta como o instrumento do arquiteto: tudo no lugar, nada sobrando, e uma única linha dourada para dizer "isto está reto". É uma interface de **operação** (registro *product*): o Tesoureiro lê tabelas, o irmão paga no celular, o Venerável confere um número. A identidade egípcia/maçônica vive nos títulos (Cinzel), no ouro, no vocabulário e nos documentos oficiais — nunca em ornamento que atrase o lançamento.

Mood: noturno, sóbrio, institucional, quente. Duas atmosferas reais: **Noite** (azul-profundo, ouro do deserto ao pôr do sol) e **Papiro** (claro de verdade, tinta sépia, ouro envelhecido); o tema **Sistema** segue o SO.

Anti-referências: SaaS "template azul + roxo"; decoração que compete com dado financeiro; esconder erro ou status; cartões aninhados e grids de cards idênticos.

### Marca

Emblema ouro (Olho de Hórus + esquadro e compasso) com wordmark "SIGMA HORUS".

| Asset | Arquivo | Uso |
|---|---|---|
| Logo completo | `public/sigmahorus_ouro.png` | Landing, login |
| Logo preto | `public/sigmahorus_preto.png` | Fundos claros / impressão |
| Emblema | `src/app/icon.png` | Favicon, sidebar compacta |
| OG / share | `src/app/opengraph-image.png` | Compartilhamento (1200×630) |

Fundo de marca (landing/login): foto egípcia `public/backgraund_theme.png` sob véu azul-noite.

## Colors

Estratégia **Restrained**: neutros tintados com o matiz da marca + **um** acento (ouro) por tela. Nunca `#000` nem `#fff`.

- **Noite:** `night-deep` #0A1628 (página), `night-surface` #0B1A2E (cards, sidebar), `night-raised` #1E3A5F (hover, modais). Texto `sand-light` #F2E8D5 / `sand` #E6D5B8 / `sand-dim` #C4B49A.
- **Ouro:** `gold` #C9A227 (ação primária, item ativo, fio de prumo), `gold-light` #D4AF37 (hover), `gold-dark` #A08020 (pressionado).
- **Papiro (claro):** `papyrus-bg` #F5F0E8, `papyrus-surface` #EDE7DB, `papyrus-raised` #E2D9CA, texto `papyrus-ink` #2D281E (sépia, não preto), ouro `papyrus-gold` #B8860B. Os tokens `--sigma-*` são **remapeados** no tema claro (`[data-theme="light"]`); as bordas `border-white/x` viram tinta sépia por override global.
- **Estado (semântico):** pago = esmeralda, vencido/erro = rosa queimado, pendente/alerta = ouro/âmbar, emitido/info = azul céu. No claro, o texto dos tons de alerta é escurecido (700/800) por override.

Regra: o ouro nunca é o único portador de significado (par com texto/ícone); no Papiro, ouro sobre bege exige o tom `gold-dark`.

## Typography

Duas vozes: **Cinzel** (capitais inscricionais — pedra gravada de templo) só em títulos cerimoniais, nome da loja, landing e títulos de página; **Geist** no corpo, UI e dados; **Geist Mono** em valores e códigos.

| Nível | Fonte | Tamanho | Uso |
|---|---|---|---|
| Display | Cinzel Bold | 30–36px | Título de página |
| Heading 1 | Cinzel Semibold | 24px | Seções da landing |
| Heading 2 | Geist Semibold | 20px | Subseções |
| Body | Geist | 16px | Conteúdo |
| Small | Geist | 14px | Metadados, tabelas |
| Caption | Geist | 12px (mínimo) | Badges, auxiliares |
| Mono | Geist Mono | 14px | Valores financeiros |

Escala ~1,25; linha de texto 65–75ch; números tabulares em tabelas.

## Layout

- **Shell do painel:** sidebar fixa (`lg:sticky`) com **acordeão single-open** por categoria (Visão geral · Social · Secretaria · Tesouraria · Hospitalaria · Administração; Secretaria e Tesouraria com subgrupos), **rail colapsável** só-ícones (persistido em `sigma.sidebar.rail`), drawer no mobile; paleta de comandos `Ctrl/Cmd+K`; cabeçalho com o **fio de prumo** abaixo.
- Itens do menu filtrados por **papel e permissão** — o cargo só vê a sua área.
- Escala de espaço 4/8/16/24/40/64; ritmo variado, não o mesmo padding em todo lugar.
- Tabelas largas rolam horizontalmente no celular; formulários em `FormCard` com largura de conteúdo (não esticam até a borda).
- Relatórios imprimem como documento oficial (cabeçalho da loja, assinaturas, selo): `ReportDocument`, `HonorBoard`, `OfficialDocument`.
- Mobile real: o portal do irmão e a fila de WhatsApp são pensados primeiro para o celular.

## Elevation & Depth

**Tonal, sem sombra.** A elevação vem do degradê e da borda, não de `box-shadow`.

| Nível | Superfície | Uso |
|---|---|---|
| 0 | `bg-sigma-app` (degradê sutil sobre `night-deep`) | Página |
| 1 | `bg-sigma-card` + `border white/6` | Cards, seções de formulário |
| 2 | `bg-sigma-card-elevated` + `border white/10` | Modais, dropdowns |
| 3 | overlay `night-deep` 80% + blur | Drawers, fundo de modal |

Exceção deliberada: os cartões de plano da landing (pergaminho com filete e glow dourado).

## Shapes

`rounded-xl` (12px) em cards, `rounded-lg` (8px) em campos e botões internos, `rounded-full` em badges e CTAs de marca. Borda fina e translúcida como moldura; nada de faixa colorida lateral nem cartão dentro de cartão.

## Components

Todos em `src/components/ui/`; usar sempre estes, nunca classes soltas equivalentes.

- **Button** — `primary` (ouro sobre azul-profundo), `secondary` (azul médio 30%), `ghost`, `danger` (rosa 15%); tamanhos sm/md/lg; transição ease-out 200ms.
- **Input / Field / MaskedInput** — rótulo **sempre visível** via `Field` (placeholder nunca faz papel de rótulo); foco = anel dourado; erro = anel rosa.
- **Card / FormCard / CollapsibleCard** — `default`, `elevated`, `interactive` (sobe 2px e borda dourada no hover).
- **Badge** — `paid · pending · overdue · billed · canceled · info/success/warning/error`, pill, ponto opcional.
- **Alert** (`intent` info/ok/warn/danger; `card` e `banner`) — única via para avisos; `role="alert"` em warn/danger.
- **ConfirmDialog / `useConfirm`** — confirmação assíncrona para ação destrutiva ou irreversível.
- **EmptyState** — ícone sutil, voz própria de cada ofício ("O Livro está limpo.") e CTA.
- **Skeleton / `loading.tsx` / `error.tsx`** — carregamento por bloco; erro com saída.
- **Tabelas** — cabeçalho `sand-dim` xs uppercase, hover `white/3`, padding `px-4 py-3`, linhas `white/5`.
- **Specials de domínio:** `Art002Alert`, `ChargeReminderDialog`, `RegisterReceiptDialog`, `WhatsappSendDialog`, `SessionDegreePicker`, `ThemeToggle`, `CommandPalette`, `MiniBar`.

## Motion

Ease-out-expo 200–300ms; sem bounce nem animar layout. `animate-reveal`/`animate-stagger` (blocos do painel, a tesouraria primeiro), `animate-rise` só no hero. Tudo respeita `prefers-reduced-motion`.

## Signatures

- **Fio de Prumo:** a única linha dourada (1px, gradiente nas pontas, 40%) entre o cabeçalho e o conteúdo de cada tela.
- **Pergaminho (landing):** `.scroll-card` — rolos laterais, fibra de papiro, filete e glow dourados nos planos.

## Do's and Don'ts

**Faça**
- Um acento dourado por tela; o resto é neutro tintado.
- Rótulo visível em todo campo; `h1` único por tela; texto ≥ 12px; foco visível.
- Usar `Alert`, `Badge`, `Field`, `useConfirm`, `EmptyState` do `ui/`.
- Dar a cada ofício a sua voz nos estados vazios.
- Testar sempre nos dois temas (Noite e Papiro) e a 375px.

**Não faça**
- `#000`/`#fff`; sombras para elevar; cards aninhados; grid de cards idênticos.
- Ornamento egípcio que atrase um lançamento.
- Trocar o estilo de gradiente ou o tema sem o dono (vetado em 2026-09).
- Usar o ouro como única pista de estado; ocultar erro ou status de ação.
- Placeholder como rótulo.
