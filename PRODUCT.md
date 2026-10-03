# Product

<!-- impeccable:product-schema 1 -->

> Reescrito em 2026-10-03 a partir do código, do manual (v1.78) e do histórico de desenvolvimento.
> A versão anterior (2026-06-30, só tesouraria) está em `.impeccable/backup-2026-10-03/`.
> Itens marcados **[inferido]** não foram confirmados pelo dono: o dono estava ausente e a entrevista
> do `init` não foi feita. Confirmar na próxima conversa.

## Platform

web

## Users

Sigma Horus atende **lojas maçônicas** (hoje: AMM 139 em produção real; Tim Maia = loja fictícia de demonstração). Cada loja é um tenant isolado; nenhuma loja enxerga outra.

Quem usa, e em que situação:

- **Administrador** — dono da conta da loja: usuários, permissões, integrações (Asaas, WhatsApp), assinatura.
- **Venerável** — gestão e aprovações (visto em pagamentos acima do limite), leitura ampla.
- **Tesoureiro** — o usuário mais intenso: lança contas a pagar/receber, emite cobranças, concilia, fecha o mês, emite balancetes. Trabalha em tabelas e relatórios, muitas vezes com a loja inteira esperando o resultado.
- **Secretário** — cadastros, sessões, convocações, livro de presença, candidatos, certificados. Não acessa a Tesouraria.
- **Hospitaleiro** — benemerência: campanhas, Tronco de Solidariedade, consulta de irmãos.
- **Obreiro/irmão (membro)** — portal próprio: o que deve, histórico, comprovante, pagar por Pix/cartão, calendário de sessões, próprio cadastro. Pouco técnico, quase sempre no **celular**.
- **Candidato** (profano em processo de admissão) — só o portal restrito: próprios débitos, cadastro e pagamento.

Cada cargo enxerga só a sua área; só a matriz de Permissões amplia. **[inferido]** idade média alta e letramento digital variado: muitos Veneráveis e Tesoureiros são sêniores, não nativos digitais.

## Product Purpose

Substituir planilhas, caderno e WhatsApp solto por um sistema confiável, rastreável e isolado por loja. O núcleo é a **tesouraria**: plano de contas, contas a pagar/receber, cobrança automática (Asaas: Pix, boleto, cartão) ou manual (Modo Loja: Pix estático + WhatsApp/e-mail), conciliação bancária, Razão por categoria, DRE, balancetes, fundos (Tronco, Doações) e a régua do Art. 002 (inadimplência). Em volta: secretaria (membros, graus, sessões, convocação com graus, presença com visitantes, certificado/diploma com `/verificar`), candidatos, hospitalaria, patrimônio e materiais, documentos, comunicação, galeria de Veneráveis, auditoria.

Sucesso = o Tesoureiro fecha o mês sem planilha paralela; o irmão paga sozinho pelo celular; o Venerável confia no número que vê; a loja é auditável.

## Positioning

Único sistema feito **por e para a liturgia e a contabilidade da loja maçônica brasileira**: graus (Aprendiz/Companheiro/Mestre), veneralato por gestão, Art. 002, Tronco de Solidariedade, Potência de origem, taxas de iniciação/elevação/exaltação/filiação, termo de compromisso, diploma assinado por Venerável e Chanceler. Um ERP genérico não fala essa língua. Preços 110/170/220 por mês (planos Oficina/Loja/Potência, ver landing); fundadoras: 30 vagas/24 meses.

## Operating Context

- Uso em **sessões de tesouraria** (desktop, tabelas longas, impressão em PDF de relatórios oficiais) e uso **casual no celular** (irmão pagando, secretário conferindo presença, Venerável aprovando).
- Os relatórios são **documentos oficiais da loja**: saem em PDF com cabeçalho, assinaturas e selo; padronizados em `ReportDocument` + `HonorBoard` + `OfficialDocument`.
- Cobrança circula por **e-mail e WhatsApp** (wa.me manual, fila em /dashboard/cobrancas/whatsapp); o texto é único para os dois canais.
- Sandbox Asaas é compartilhada entre as duas lojas de teste (mesma conta) — particularidade de teste, não de produto.
- Tema claro "Papiro" e escuro "Noite" + "Sistema": a loja pode estar em sala escura (sessão) ou ao sol (celular).

## Capabilities and Constraints

- Stack: Next.js (App Router) + React + Tailwind v4 + Prisma 7 + Postgres (Railway) com RLS por loja; deploy no Vercel (push na `main` publica); R2 para arquivos; Stripe para a assinatura da plataforma; Asaas por loja (chave própria).
- Papéis: admin, venerable, treasurer, secretary, hospitaller, member, candidate (este último fixo, fora da matriz).
- Termos que a UI deve respeitar: Ir∴, T∴F∴A∴ (só em contexto cerimonial; e-mails de candidato usam "Prezado(a)"), Oriente, Venerável Mestre, Chanceler, Obreiro, Quit Placet, "Art. 002".
- Migrations: nunca editar uma migration já entregue; sempre uma nova (incidente de 2026-10-02).
- Fundos = categorias (Tronco/Doações sem caixa próprio). Mensalidade = flag **ou** categoria.
- Dado maçônico sensível: pasta de candidato é sigilosa; nada de profano aparece como "irmão".
- Em aberto: Multiloja (prometido antes, não existe, removido da landing); cartão de taxa de grau no Modo Loja (decisão: fora); teste ponta a ponta do cartão na sandbox pendente.

## Brand Commitments

- Nome **Sigma Horus**; emblema ouro (Olho de Hórus + esquadro e compasso) e wordmark "SIGMA HORUS" — arquivos em `public/sigmahorus_ouro.png`, `sigmahorus_preto.png`, `src/app/icon.png`.
- Assinatura: "A tesouraria da sua loja no prumo". Fio de prumo = a única linha dourada por tela.
- Identidade egípcia/maçônica **presente, mas sem roubar a tarefa** (cerimônia leve).
- O dono vetou trocar o estilo de gradiente (`bg-gradient-to-*`) e o tema; refinamentos preservam a identidade atual.

## Evidence on Hand

- AMM 139 em produção desde 29/08/2026 (31 obreiros); loja demo Tim Maia fictícia.
- Manual do usuário embutido (`/manual`, v1.78) e capítulo por cargo.
- Críticas anteriores: `impeccable-critique-2026-06-30.md` (28/40) e `.impeccable/critique/2026-09-19…` (27/40, repasse geral).
- **Ausências que não podem ser inventadas:** depoimentos de clientes, números de adesão, certificações; métricas de uso reais além do que o banco registra (`acquisitionSource`).

## Product Principles

1. **O número certo, lido rápido.** Dado financeiro sem ambiguidade; quem decide (Venerável) e quem executa (Tesoureiro) leem a mesma verdade.
2. **Cada um na sua área, cada loja só a si mesma.** Acesso mínimo por cargo; a interface esconde o que o cargo não pode, e o servidor garante.
3. **Rastro de tudo, sem pedir esforço.** Alteração relevante deixa auditoria; relatórios são documentos oficiais assináveis.
4. **O irmão resolve sozinho no celular.** Pagar, ver o que deve e pegar o comprovante sem ligar para o Tesoureiro.
5. **Cerimônia leve.** A liturgia aparece na voz, nos títulos e nos documentos — não em ornamento que atrasa o lançamento.

## Accessibility & Inclusion

- Alvo **WCAG AA**; foco visível, "Pular para o conteúdo", `h1` único por tela (dívida: 13 telas de relatório com `h1` duplicado no cabeçalho de impressão), texto mínimo 12px, rótulos sempre visíveis (`Field`), respeito a `prefers-reduced-motion`.
- Público com muitos usuários sêniores **[inferido]**: alvos de toque ≥ 44px, contraste alto nos dois temas, linguagem direta, confirmação antes de ação destrutiva.
- Português do Brasil; datas/valores em pt-BR; fuso de Brasília (datas só-data gravadas em UTC).
