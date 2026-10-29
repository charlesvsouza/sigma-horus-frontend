---
target: telas de 2026-10-03 (Relatórios, Portal, Acordos+Termo, Documentos, Balaustre, Conciliação, Pagamentos, Toast)
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\sygmahorus\\apps\\frontend\\src\\app\\dashboard"
timestamp: 2026-10-03T22-10-00Z
slug: src-app-dashboard
---
# Critique — telas de 03/10/2026 (modo Operate) — single-context

Score 29/40 (Bom). Subiu de 27/40 (19/09).

## Heurísticas
1 Visibilidade 3 · 2 Linguagem 3 · 3 Controle 3 · 4 Consistência 3 · 5 Prevenção de erros 2 · 6 Reconhecimento 3 · 7 Flexibilidade 3 · 8 Minimalismo 3 · 9 Recuperação 3 · 10 Ajuda 3

## Especificidade
Autoral (Cinzel, linguagem de loja, termo com assinatura digital). Detector: 4 avisos consultivos (0.95rem, 11px, #888 fora da escala/paleta).

## Prioridades
- [P1] Papiro reprova em contraste: botão principal (texto claro sobre ouro 2,87:1) e text-sand-dark (3,4–4,2:1 em 12–14px); 7–21 textos reprovados por tela no Papiro, 0–1 no Noite. Fix: sand-dark #625847; tinta #2D281E sobre ouro; verde da marca mais escuro. (colorize)
- [P1] Conciliação: palpite fraco com o mesmo botão primário do certo. Fix: só a melhor sugestão é primária; as demais secundárias com confirmação citando o nome divergente. (harden)
- [P2] Assinar o termo é discreto (link de 16px) e sem confirmação. Fix: botão no cartão, confirmação "Assino em nome de X", mostrar quem falta. (clarify)
- [P2] Alvos de toque: links, caixas de marcar (20px), selects (32px) e campo de arquivo fora da regra de 44px. (adapt)
- [P2] Pagamentos: aviso de dinheiro no Asaas acima do h1; "MVP" no subtítulo; checkbox "Declaro estar ciente" a cada registro. (layout)

## Personas
Casey (links/caixas pequenos, 12px a 4,2:1 ao sol, marca 10px), Sam (Papiro 2,87:1; descrições só no foco), Jordan (assinar escondido), Alex (sem desfazer na conciliação).

## Menores
Portal repete dívidas em Pendências e Extrato; cartão de documentos vazio enorme; sessão com 9,5 mil px no celular; voltar/trancar com 20px; linha reservada nos cartões de Relatórios.
