---
target: dashboard geral (experiência UX/UI)
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\sygmahorus\\apps\\frontend\\src\\app\\dashboard (experiência geral do painel)"
timestamp: 2026-09-16T08-19-37Z
slug: src-app-dashboard-experi-ncia-geral-do-painel
---
# Crítica UX/UI — Sigma Horus (dashboard + páginas públicas)

**Método: dual-agent (A: revisão de design · B: detector + evidência de navegador)**

## Nota de escopo

Tema visual (paleta, tipografia, identidade Egito/maçonaria, Escuro/Papiro) tratado como **travado** — todos os achados abaixo são refinamentos de interação, consistência, cópia e acessibilidade dentro do sistema já definido, nunca sugestão de redesign visual.

## Placar de saúde de design (Heurísticas de Nielsen)

| # | Heurística | Nota | Achado-chave |
|---|---|---|---|
| 1 | Visibilidade do status do sistema | 2 | Sucesso e erro renderizam como o **mesmo** `Alert intent="warn"` em Membros e Cadastros |
| 2 | Correspondência com o mundo real | 2 | Portal do obreiro rotula o que ele **deve** como "A receber" (linguagem do tesoureiro, não do membro) |
| 3 | Controle e liberdade do usuário | 2 | Configurações da loja: nenhum aviso de alteração não salva; "Aplicar cargos" salva o formulário inteiro sem pedir |
| 4 | Consistência e padrões | 1 | Cadastros mestre bifurca o design system: `CollapsibleCard` local, classes soltas, edição via `getElementById` — no mesmo arquivo que usa os componentes certos |
| 5 | Prevenção de erros | 1 | Excluir conta financeira, aprovar/rejeitar transferência e marcar material extraviado: **um clique, sem confirmação** |
| 6 | Reconhecimento em vez de memorização | 2 | `placeholder` como rótulo em quase todo formulário; some ao editar um valor já preenchido |
| 7 | Flexibilidade e eficiência | 2 | Paleta de comandos (⌘K) só navega, não executa ações; checkbox de Termos de Uso em **toda** baixa de pagamento |
| 8 | Design estético e minimalista | 3 | Disciplina de ouro bem mantida; Cadastros e Configurações empilham domínios não relacionados numa página só |
| 9 | Ajudar a reconhecer/corrigir erros | 1 | `membros` e `portal` não têm `try/catch` — um 500 do servidor deixa a tela "Carregando..." para sempre |
| 10 | Ajuda e documentação | 3 | Manual bem indexado e com tooltips úteis; alguns só em `title` (invisível no touch) |
| **Total** | | **19/40** | **Faixa: Fraco** (12–19) |

Nenhuma heurística foi marcada N/A — é um produto completo de admin + autoatendimento, todas as dez se aplicam. Nota honesta: a maioria das interfaces reais fica entre 20 e 32; 19 reflete problemas concretos e recorrentes, não uma opinião severa.

## Veredito de especificidade de design

**A moldura é autoral; os cômodos, não.**

O chrome do produto é genuinamente Sigma Horus: um único "Fio de Prumo" por página, o cabeçalho com "LOJA MAÇÔNICA" sobre o nome da loja, o cargo exibido como "Obreiro" e não "Member", o tema Papiro como remapeamento completo de tokens (não um dark-mode invertido). A disciplina do ouro é real — aparece só em CTA primário, item ativo do menu, nome da loja e no fio de prumo.

Mas as telas de conteúdo (Contas, Pagamentos) poderiam ser trocadas por qualquer SaaS financeiro genérico só mudando os textos. E a prova decisiva: o `DESIGN.md` documenta explicitamente uma "voz cerimonial" por ofício para os estados vazios — *"Tesouraria: Nenhum lançamento. O Livro está limpo."* — como uma assinatura do produto. **Nenhuma dessas quatro frases existe no código.** Busca no repositório: zero ocorrências. As 16 telas com estado vazio usam o genérico "Nenhum(a) [substantivo] cadastrado". É a peça de autoria mais barata e de menor risco visual que o próprio sistema de design já escreveu — e que nunca foi implementada, bem no momento em que uma loja nova forma sua primeira impressão.

**Confirmação pelo scanner mecânico (Assessment B):** o scan determinístico (`impeccable detect`) rodou limpo (0 achados, saída 0) sobre `src/app/dashboard` e `src/components` — verificado com um teste de sanidade (o mesmo scanner pegou uma violação de contraste sintética de propósito, confirmando que a ferramenta está funcionando; o resultado limpo é real, não uma falha silenciosa). Isso não contradiz os achados acima: o scanner pega *cheiros visuais mecânicos* (contraste, tipografia, gradientes), não inconsistência de interação/IA, que é o que a Assessment A caçou.

**Evidência visual ao vivo (landing/login, não autenticado — o dashboard exige login com banco de produção, fora do escopo seguro desta rodada):** o overlay do detector encontrou 15 ocorrências na landing e 2 no login. A maioria (glow dourado nos cards de papiro, "kicker" acima do título, quase-monotipografia em Geist) bate com decisões **já documentadas** no próprio histórico do projeto como intencionais — provável falso positivo. Uma achou algo real: texto com tinta sépia (`#2D281E`) sobre fundo azul-marinho escuro em vez do papiro (`rgba(245,237,214,0.60)`) para o qual essa cor foi desenhada, medindo **1.2:1 de contraste** (mínimo exigido: 4.5:1) — isso é plausivelmente um bug real de contraste, não um artefato do detector, porque a cor foi pensada para outro fundo. Vale conferir visualmente.

## Impressão geral

A parte "de vitrine" do produto (fio de prumo, tema Papiro, o relatório de Fechamento impresso) mostra cuidado genuíno de quem entende o domínio. A parte "de trabalho" (formulários do dia a dia, o Cadastros mestre, o portal do obreiro) foi claramente construída sob pressão de prazo: padrões corretos existem (`useConfirm`, `Alert` com `intent`, `FormCard`) mas são adotados de forma desigual, inclusive nas duas funcionalidades lançadas hoje (Transferências e Materiais). A maior oportunidade não é visual — é fechar a lacuna entre o que o design system já resolveu certo e o que cada tela nova reaproveita.

## O que já funciona bem

1. **`FormCard` carrega sua própria justificativa no código** (`ui/form-card.tsx:4-8`): um comentário cita a crítica anterior que motivou o `max-w-2xl`, nomeando as telas corrigidas. É assim que um design system para de regredir — o próximo dev não consegue desfazer sem entender por quê.
2. **Divulgação progressiva no formulário de Membro** (`membros/page.tsx:511-527,609-614`): ao criar, mostra ~7 campos; ao editar um cadastro completo, só abre os blocos que já têm dado. Um dossiê de 40 campos maçônicos vira um formulário que o Secretário realmente termina.
3. **Superfícies cientes de token** (`globals.css:118-141` + bloco Papiro 374-432): `.bg-sigma-app`/`.bg-sigma-card` usam `color-mix()` sobre os mesmos tokens, então o tema Papiro flui de uma fonte só — e o override corrige falhas reais do Tailwind (texto sumindo no pergaminho) na variável, não duplicando componente.

## Problemas prioritários

### [P0] O Tesoureiro não consegue chegar à tela que cria as contas bancárias que o próprio trabalho dele exige — **confirmado por mim, é uma regressão de hoje**
**O quê:** `Pagamentos` agora exige `bankAccountId` (obrigatório, mudança lançada hoje). A única origem desse dado é "Contas bancárias e Caixa", dentro de `Cadastros mestre`. Mas `layout.tsx:25` restringe essa página a `roles: ['admin','venerable','secretary']` — **`treasurer` não está na lista** (conferi agora no código). A paleta de comandos ⌘K é construída a partir do mesmo menu filtrado, então também não aparece lá para o Tesoureiro. Pior: `TransferenciasClient.tsx` manda o usuário "cadastrar em Cadastros mestre" — um destino que não existe no menu dele.
**Por que importa:** bloqueia a tarefa mais frequente de um produto de tesouraria, numa loja que ainda não tenha uma conta financeira pré-criada por um Admin/Secretário.
**Correção:** adicionar `'treasurer'` aos `roles` de `/dashboard/cadastros` (mínimo, uma linha) — ou, melhor, promover "Contas bancárias e Caixa" para um item próprio em Financeiro (`roles: ['admin','venerable','treasurer']`), tirando de quebra um dos cinco domínios empilhados em Cadastros mestre.
**Comando sugerido:** `$impeccable layout` (reestrutura de IA) ou correção direta, é trivial.

### [P1] Ações destrutivas e de movimentação de dinheiro sem confirmação, sem rótulo visual diferenciado — **inclui a funcionalidade de Transferências lançada hoje**
**O quê:** `ContasClient.tsx:113-116` exclui uma conta financeira em um clique, sem confirmação e sem feedback de erro. `TransferenciasClient.tsx:144-145` aprova/rejeita transferência entre contas bancárias — a ação cuja única razão de existir é um segundo par de olhos sobre dinheiro — com um link de 12px, **sem `useConfirm`** (confirmei: o arquivo nem importa o hook) e sem reapresentar o valor no momento da aprovação. `MaterialsClient.tsx:303` baixa material como extraviado do mesmo jeito.
**Por que importa:** o segundo princípio do PRODUCT.md é "confiança por rastreabilidade" — um clique único e não confirmado é o oposto disso, e o padrão certo já existe e está montado globalmente (`ConfirmProvider` em `DashboardShell.tsx:346`, usado em outros 10 arquivos).
**Correção:** envolver toda ação irreversível em `useConfirm`, reapresentando o valor/consequência no corpo do diálogo (ex.: "Transferir R$ 12.500,00 de Santander CC para Caixa da Loja?").
**Comando sugerido:** `$impeccable harden`

### [P1] Sucesso e erro são visualmente idênticos, e várias mutações não avisam nada
**O quê:** `membros/page.tsx:322` e `CadastrosClient.tsx:301` mostram **todo** resultado como `Alert intent="warn"` (amarelo) — inclusive mensagens de sucesso. Dez mutações em `CadastrosClient` (renomear rito/potência/conta, remover, ativar/desativar) nunca checam `response.ok` nem mostram mensagem — uma falha silenciosa reverte na tela sem explicação. `ConfiguracoesClient.tsx:178` usa uma `<div>` crua em vez do `<Alert>` já importado, perdendo o contraste do tema Papiro e o `role` de acessibilidade.
**Por que importa:** o próprio PRODUCT.md lista como anti-referência exatamente isto: "fluxos que ocultam status de erro ou feedback de ações."
**Correção:** padronizar a mensagem como `{kind:'ok'|'error'}` (já existe em `ContasClient.tsx:31`) em todo lugar; checar `res.ok` nas dez mutações; trocar a `<div>` pelo `<Alert>`; envolver `membros/page.tsx:206` e `portal/page.tsx:267` em `try/catch` (hoje, um erro 500 trava "Carregando..." para sempre).
**Comando sugerido:** `$impeccable harden`

### [P2] Formulários longos entregam feedback fora da tela e perdem trabalho em silêncio
**O quê:** em `ConfiguracoesClient.tsx`, a mensagem de resultado renderiza na linha 178 e o botão Salvar fica na linha 355 — ~1.300px de distância, sem scroll automático e sem aviso de alteração não salva. O time já resolveu isso uma vez (`membros/page.tsx:174-180`, com comentário explicando o motivo) mas só aplicou em 2 dos 4 pontos daquele arquivo, e em nenhum outro formulário longo.
**Correção:** promover o padrão `notify()` (scroll + mensagem) para um hook compartilhado; adicionar barra fixa de "alterações não salvas" em Configurações.
**Comando sugerido:** `$impeccable clarify`

### [P3] Moeda formatada de duas formas incompatíveis
**O quê:** 19 pontos usam `R$ ${n.toFixed(2)}` → **"R$ 1250.00"** (ponto americano, sem separador de milhar) — inclusive no extrato impresso do próprio obreiro (`portal/page.tsx:485`). Outros 12 arquivos usam `toLocaleString('pt-BR', {style:'currency'})` corretamente.
**Correção:** extrair um `brl()` único (a implementação certa já existe, duplicada, em 4 arquivos) e trocar os 19 pontos.
**Comando sugerido:** `$impeccable clarify`

## Sinais de alerta por persona

**Alex (Tesoureiro apressado):** bloqueado na porta pelo P0 acima; um checkbox de "Termos de Uso" em toda baixa de pagamento (`PagamentosClient.tsx:129-137`) taxa a tarefa mais repetida do produto; ⌘K só navega, não executa ações.

**Jordan (obreiro no primeiro acesso ao portal):** vê o que deve como "A receber" (`portal/page.tsx:349-358`); o card financeiro mostra R$ 0,00 por um instante antes do valor real (nenhum gate de loading); "Meu extrato" — o motivo dele estar ali — vem recolhido por padrão; o aviso de Art. 002 (inadimplência) some sozinho em 10 segundos sem mostrar o valor devido nem um link.

**Sam (dependente de acessibilidade):** `htmlFor` aparece em um único arquivo do projeto inteiro; `aria-expanded` aparece uma única vez em todos os componentes recolhíveis do dashboard; a "tabela" de Membros é uma grade de `<button>`s sem semântica de tabela; nenhum diálogo de confirmação prende o foco. No lado das páginas públicas: `/manual` tem **dois `<h1>` na mesma página** e nem `/manual` nem `/sobre` têm um marco `<main>` (confirmado pela varredura de DOM do Assessment B).

**Casey (uso real no celular):** a alegação de "mobile real" do PRODUCT.md se sustenta no shell (drawer, header responsivo) mas não nas telas de dados — as tabelas do relatório de Fechamento (`sections.tsx`) não têm `overflow-x-auto`, então uma tabela financeira de 6 colunas deve estourar a largura num celular de 400px; ações de linha (Editar/Remover) ficam abaixo do alvo de toque de 44px e adjacentes — em Contas, isso é um "Remover" de registro financeiro a um dedo de distância do "Editar", sem confirmação (mesmo problema do P1).

## Observações menores

- O toggle de tema (Escuro/Papiro/Sistema) só existe em Configurações, página exclusiva do Admin — os outros 5 papéis não conseguem trocar de tema, justamente o recurso mais útil para uso ao ar livre no celular.
- `art002-alert.tsx` é a única superfície do dashboard com `box-shadow` e a única com `text-white` — ambos contra regras que o próprio `DESIGN.md` define.
- Não existe sistema de toast (o `DESIGN.md` especifica um); todo erro hoje é um `Alert` inline no topo da página.
- Títulos de página são `text-2xl`; o `DESIGN.md` especifica 3xl–4xl para "Display" — descompasso entre doc e código, resolver num sentido ou no outro.
- `Badge` (9 variantes documentadas) é importado em 3 de ~70 arquivos do dashboard; o resto "reinventa" badge com classes soltas, cada um ligeiramente diferente.
- `Card` (componente) quase não é usado — a maioria escreve `rounded-xl border border-white/[6%] bg-sigma-card p-6` à mão, com `p-6` em vez do `p-5` do componente.
- Na landing (achado do Assessment B), um `fullPage` screenshot automatizado (sem rolagem real) não captura duas seções inteiras — indício de conteúdo controlado por `IntersectionObserver`/scroll que ferramentas de captura automática (regressão visual, "imprimir página inteira") podem não disparar. Não afeta quem rola a página normalmente, mas vale considerar se algum dia houver testes de regressão visual automatizados.

## Perguntas para você

1. **A voz cerimonial dos estados vazios foi cortada de propósito, ou simplesmente não chegou a ser implementada?** É a autoria mais barata do sistema (zero risco visual) e ela documenta 4 frases prontas que nunca entraram no código.
2. **"Cadastros mestre" é uma página com dono, ou virou uma gaveta onde cinco domínios não relacionados foram empilhados?** Ela também é o único lugar do app que bifurcou os padrões do design system (componente local, edição via `getElementById`).
3. **Quero que eu já corrija o P0 (Tesoureiro sem acesso às contas bancárias) agora, antes de qualquer outra coisa?** É uma regressão real de hoje, não um problema de opinião de design.
