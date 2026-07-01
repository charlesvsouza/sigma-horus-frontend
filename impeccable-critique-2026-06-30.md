# Relatório de Crítica de Design — Sigma Horus
Data: 2026-06-30
Alvo: Fluxo público de planos (`src/app/page.tsx` + `src/components/plans-section.tsx`) e página de assinatura logada (`src/app/dashboard/assinatura/page.tsx` + `SubscriptionManager.tsx`).
Fonte: skill `impeccable` v3.8.0 + leitura direta dos arquivos.

## 1) Cena e estratégia de cor
Cena confirmada: uso diurno/nocturno, desktop e celular, tensão financeira/cerimonial. A estratégia atual é coerente: azul profundo egípcio + ouro. Mantém.

## 2) Pontos fortes mantidos
- Identidade egípcia consistente, sem parecer template genérico.
- Paleta tokens aplicada em múltiplas telas.
- Tema claro/sistema implementado.
- Server Component trajectory saudável em dashboard.
- RBAC granular, isolamento por tenant e rastreabilidade já são diferenciais de produto, não só visual.

## 3) Problemas identificados
### 3.1 Fluxo de checkout sem mensagem de erro visível
`plans-section.tsx` e `SubscriptionManager.tsx` redirecionam em `window.location.href = data.url`, mas se `data.url` for falsy ou a resposta retornar erro, o usuário fica sem feedback. Isso pode mascarar a causa real do 500 no checkout.
Severidade: alta.
Recomendação: exibir estado de erro dentro do componente, não depender só do `window.location.href`.

### 3.2 Estados de carregamento e bloqueio globais
Os botões usam `disabled={loading !== null}` no card, mas a seleção de intervalo/método permanece ativa durante o carregamento, permitindo corrida de cliques.
Severidade: média.
Recomendação: travar toda a seção enquanto `loading !== null` ou usar transição com `useTransition`.

### 3.3 Falta de affordance no card sem sessão (landing)
Os CTAs apontam para `/onboarding` e `/comecar/concluir` sem mostrar claramente qual a etapa atual do funil. O texto “Comece com 10 dias de teste” aparece antes do usuário ver preço final com desconto.
Severidade: média.
Recomendação: manter um resumo de custo no hero ou microcopy mais explícito antes do bloco de planos.

### 3.4 Reforço repetitivo de selo/badge
Uso frequente de “Mais escolhido” e “Atual” nos cards com estrutura semelhante. Em telas pequenas aumenta ruído visual.
Severidade: baixa.
Recomendação: usar só um deles por bloco ou reduzir opacidade/contraste em mobile.

### 3.5 Tema claro sem validação visual final fora do código
O tema claro está implementado, mas há campos como `white/10` e bordas claras que dependem do browser. Sem snapshot visual, o relatório não consegue confirmar legibilidade final em produção.
Severidade: média.
Recomendação: validar com screenshot no navegador ou com uma seletiva de verificação visual.

## 4) Riscos técnicos relevantes ao fluxo crítico
- Incoerência de credenciais Stripe entre `.env` e produção (risco principal para checkout).
- Falta de `PRODUCT.md` no diretório do app, o que enfraquece a continuidade do padrão `impeccable`.

## 5) Recomendações prioritárias
1. Ajustar primeiramente o fluxo de checkout para ter fallback de erro visível antes de ajustes cosméticos da landing.
2. Verificar integridade das env vars Stripe antes de outro deploy.
3. Validar tema claro e contraste com snapshot visual real.
4. Manter as melhorias recentes (sidebar, command palette, tonalidade unificada).