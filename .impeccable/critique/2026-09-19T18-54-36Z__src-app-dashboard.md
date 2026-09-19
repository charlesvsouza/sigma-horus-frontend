---
target: repasse geral do sistema (src/app/dashboard)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\sygmahorus\\apps\\frontend\\src\\app\\dashboard"
timestamp: 2026-09-19T18-54-36Z
slug: src-app-dashboard
---
Crítica geral (repasse de 19/09/2026) — 50 páginas, desktop 1280 e celular 390, Tim Maia com dados de exemplo. Fora do alcance por decisão do dono: tokens, cores, fontes, globals.css, sidebar/header, login. Modo degradado: single-context.

Nota: 27/40 (Aceitável, no limite de Bom). Detector: 0 achados.

P1 Campos sem rótulo visível (16 telas: Cobranças 9, Integrações 10, Patrimônio 9, Comunicação, Documentos, Sessões, Veneralato…) — clarify.
P1 Tarefa do dia depois da tarefa rara: Contas e Cobranças abrem por formulário; lista a partir de y≈1000/1704 — layout.
P1 Hierarquia financeira: manchete da Visão geral é a receber−a pagar (−R$285,40), não saldo em caixa; receita/despesa indistinguíveis em Contas; valores sem alinhamento tabular — layout.
P2 Celular: Fundos +184px de overflow (tabela 529px), Cadastros +24px; 42 usos de texto 10–11px — adapt.
P2 Ação principal diluída: 3 botões dourados em Fundos; "Processar recorrentes" em Cobranças — polish.
P2 Estrutura/a11y: 2 h1 em 44/50 páginas; sem skip-link; sem loading.tsx/error.tsx (0/50); <script> em componente na Integrações — harden.
P3 Copy "fluxo do MVP" em Contas; Editar/Remover de baixo contraste; largura de container inconsistente; 13 arquivos com alerta de classe solta; 6 com bg-gradient-to (não tocado).
