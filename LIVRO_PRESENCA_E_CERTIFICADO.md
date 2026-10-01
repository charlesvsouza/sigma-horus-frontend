# Livro de presença, visitantes e certificado de presença — análise e plano

> Status: **em execução** (retomado em 2026-09-29). **Fase 1 concluída** (livro de presença e lista de visitantes em branco: `sessoes/[id]/livro`, `sessoes/[id]/lista-visitantes`, `lib/attendance-book.ts`, `lib/session-sheets-server.ts`). **Fase 2 concluída** (migration `20260929220000_add_visitors`: `Visitor`, `SessionVisitor` com RLS e campos do certificado; `api/visitors`, `api/sessions/[id]/visitors`; painel na sessão com sugestão de cadastro; lista preenchida; Secretaria → Visitantes com histórico, edição e exclusão LGPD). **Fase 3a concluída** (certificado com nome impresso: `lib/certificate.ts` texto/numeração/código, `lib/certificate-pdf.ts` diploma em pdf-lib com modelos Clássico e Pergaminho, `lib/certificate-server.ts`, `api/certificates/[visitId]` prévia/baixar e `/send`, página pública `/verificar/[code]`, Social → Certificados de presença; fontes OFL em `src/assets/fonts`). **Fase 4 implementada** (2026-09-30: Modelo da loja — arte de fundo + layout por loja, `lib/certificate-art.ts`, painel Arte da loja, `scripts/setup-certificate-art.ts`; sem número/QR impressos, por decisão do dono). Próxima: fase 3b (assinaturas digitalizadas).
>
> **Decisões do dono (2026-09-29):**
> 1. Diploma: modelos prontos agora (Clássico e Pergaminho), arte própria da loja depois (fase 4).
> 2. Assinaturas: digitalizada opcional (Venerável e Secretário sobem a imagem); sem imagem, nome impresso.
> 3. Lista de visitantes: nome, **grau**, loja, **nº da loja**, **Oriente**, Potência, **CIM**, **telefone**, e-mail e assinatura.
> 4. Livro de presença: **cargos primeiro** (ordem ritualística), depois os demais em ordem alfabética.
> 5. Certificado só para visitantes (não para membros da loja).
> 6. Envio do certificado manual, pelo botão, depois de revisar.
> 7. Verificação pública com QR Code.

## 1. O que o dono pediu

1. **Livro de presença dos membros**, próprio do sistema, para imprimir e colher **assinaturas**:
   cabeçalho com o escopo da sessão e a lista **dos convocados**.
2. **Lista de presença de visitantes** (não membros), impressa em branco para o visitante
   preencher: nome do obreiro, loja, Potência e e-mail.
3. **Cadastro de visitantes** na **Secretaria**: o Secretário digita a lista preenchida,
   ligada à sessão do dia.
4. **Certificado de presença** no modelo de **diploma maçônico**, montado pelo sistema com os
   dados da sessão e do visitante e **enviado por e-mail** ao irmão visitante. Fica na aba **Social**.

## 2. O que já existe e será reaproveitado

| Peça | Onde | Uso aqui |
|---|---|---|
| Sessão com título, início/término, tipo, **graus trabalhados**, ordem do dia | `Session` + tela da sessão | cabeçalho do livro e texto do certificado |
| Quem é convocado (menor grau) | `lib/session-convocation.ts` | nomes do livro de presença |
| Presença dos membros (presente/ausente) | `Attendance` + tela da sessão | continua sendo o registro no sistema; o livro é o papel assinado |
| Papel timbrado da loja (brasão, nome, Oriente, rito, Potência) | `lib/letterhead.ts` + `components/report/official-document.tsx` | cabeçalho do livro e das listas |
| Moldura dourada e peça "para emoldurar" | `components/report/honor-board.tsx` | referência visual do diploma |
| Impressão A4 pelo navegador | `report-document` (`printCss`) | livro e lista de visitantes |
| E-mail com anexo | `lib/messaging.ts` (`dispatch` com `attachments`, Resend) | envio do certificado em PDF |
| Registro de envios | `MessageLog` (+ `ref`, da convocação) | histórico "certificado enviado em…" |
| QR Code | pacote `qrcode` | código de verificação no certificado |

**O que falta:** não existe cadastro de visitantes, nem geração de **PDF no servidor**. Os
documentos atuais são impressos pelo navegador, e um PDF para anexar no e-mail precisa ser
gerado no servidor (ver seção 6).

## 3. Visão geral do fluxo

```text
ANTES DA SESSÃO (Secretaria → Sessões → sessão)
  Imprimir "Livro de presença"        → folha com os convocados + linha de assinatura
  Imprimir "Lista de visitantes"      → folha em branco para os visitantes preencherem

NA SESSÃO
  Irmãos assinam o livro · visitantes preenchem a lista (com consentimento do e-mail)

DEPOIS DA SESSÃO (Secretaria)
  Marcar presença dos membros (já existe)
  Aba "Visitantes" da sessão → cadastrar cada visitante da lista (reaproveita o cadastro
    se o irmão já visitou antes) → ficam ligados à sessão de dd/mm/aaaa
  (opcional) Reimprimir a lista de visitantes já digitada, para arquivo

CERTIFICADOS (Social → Certificados de presença)
  Escolher a sessão → ver os visitantes → "Revisar certificados" (prévia do PDF real)
  → "Enviar por e-mail" → cada visitante recebe o seu certificado em PDF + link de verificação
```

## 4. Livro de presença dos membros (impressão)

- Botão **"Imprimir livro de presença"** na tela da sessão.
- **Quem aparece:** os **convocados** pelos graus da sessão, a mesma lista da convocação. Numa
  sessão de 1º e 2º grau, os Aprendizes assinam também.
- **Ordem:** alfabética, com o número de cada irmão. A decidir: agrupar por grau ou pôr os
  cargos em loja primeiro (seção 8).
- **Linhas em branco** no fim, para quem chegou sem estar na lista (ex.: irmão regularizado depois).
- **Fecho:** "Total de presentes: ____" e assinaturas do Venerável Mestre e do Secretário.
- Se a sessão foi **alterada depois de impressa**, o sistema não tem como saber. Por isso a
  folha traz no rodapé a data e a hora da impressão.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                     [brasão]  A∴R∴L∴S∴ TIM MAIA Nº 000                 │
│            Oriente de Rio de Janeiro · REAA · GOB                    │
│ ════════════════════════════════════════════════════════════════════ │
│                        LIVRO DE PRESENÇA                              │
│  Sessão Ordinária — "Sessão ordinária de outubro"                     │
│  Quinta-feira, 1º de outubro de 2026, 19h30 às 22h00                  │
│  Graus trabalhados: Aprendiz e Companheiro                            │
│  Ordem do dia: 1. Abertura em grau de Aprendiz · 2. Elevação …        │
│ ──────────────────────────────────────────────────────────────────── │
│  Nº │ Irmão                     │ Grau         │ Assinatura           │
│  01 │ Carlos Alberto Souza      │ Mestre       │ ____________________ │
│  02 │ Yuri Pereira              │ Aprendiz     │ ____________________ │
│  …  │                           │              │                      │
│  25 │ ________________________  │ ____________ │ ____________________ │
│ ──────────────────────────────────────────────────────────────────── │
│  Total de presentes: ______                                           │
│  ___________________          ___________________                     │
│  Venerável Mestre             Secretário                              │
│  Impresso em 30/09/2026 10:12 por Fulano                              │
└──────────────────────────────────────────────────────────────────────┘
```

Sem migration: é só leitura da sessão e dos membros.

## 5. Visitantes

### 5.1 Lista de visitantes para preencher (impressão)

Botão **"Imprimir lista de visitantes"** na tela da sessão. É uma folha com o mesmo cabeçalho do
livro e linhas em branco.

| Coluna | Por quê |
|---|---|
| Nome do obreiro | pedido pelo dono |
| **Grau** | o certificado diz em que grau ele visitou; e só pode estar na parte da sessão do grau dele |
| Loja (nome e nº) | pedido pelo dono |
| **Oriente** | identifica a loja; usado no certificado |
| Potência | pedido pelo dono |
| E-mail | pedido pelo dono, para o envio do certificado |
| Assinatura | vale como registro de presença |

Rodapé com o **consentimento (LGPD)**: *"Ao informar seu e-mail, você autoriza a Loja a enviar
seu certificado de presença. Seus dados não serão usados para outro fim."*

Grau e Oriente são **sugestões minhas**; confirmar na seção 8.

### 5.2 Cadastro de visitantes (Secretaria)

- **Dois lugares, a mesma informação:**
  - **Aba "Visitantes" da sessão:** onde o Secretário digita a lista do dia. Ao digitar o nome
    ou o e-mail, o sistema sugere quem já visitou antes, para não duplicar.
  - **Secretaria → Visitantes:** o cadastro geral, com busca e o histórico de visitas de cada
    irmão (sessões e certificados enviados).
- **Visitante é reaproveitável:** o mesmo irmão que volta mês que vem não é digitado de novo;
  só se liga à nova sessão.
- **Dados de cada visita:** o grau em que ele esteve (pode ter sido elevado desde a última
  visita) e a situação do certificado (não enviado / enviado em… / falhou).
- **Reimprimir a lista digitada:** a mesma folha da 5.1, já preenchida, para arquivo.
- **Excluir visitante:** apaga os dados pessoais (direito LGPD) e mantém só "visitante removido"
  nas sessões, para a contagem não mudar.

### 5.3 Modelo de dados (migration nova)

```text
Visitor            (cadastro por loja)
  id, lodgeId, name, email?, phone?, degree (1–3, ou filosófico), lodgeName, lodgeNumber?,
  orient?, powerName?, cim?, consentAt?, createdAt, updatedAt
  único por (lodgeId, email) quando houver e-mail

SessionVisitor     (a visita)
  id, lodgeId, sessionId, visitorId, degreeAtVisit, createdAt
  certificateNumber?   (ex.: CP-2026-0001, sequencial por loja/ano)
  certificateCode?     (código de verificação, curto e aleatório)
  certificateSentAt?, certificateStatus?
  único por (sessionId, visitorId)
```

Os dois modelos têm RLS por loja, como os demais, e entram no backup da plataforma e no
backup/exportação da loja.

## 6. Certificado de presença (aba Social)

### 6.1 Texto (proposta)

> **CERTIFICADO DE PRESENÇA**
>
> A Augusta e Respeitável Loja Simbólica **Tim Maia nº 000**, jurisdicionada ao **Grande Oriente
> do Brasil**, ao Oriente de **Rio de Janeiro**, certifica que o Ir∴ **João da Silva**, **Mestre**,
> do Quadro da Loja **Estrela do Sul nº 123**, ao Oriente de **Niterói**, **GOB**, esteve presente
> à **Sessão Ordinária** realizada em **1º de outubro de 2026**, nos Graus de **Aprendiz e
> Companheiro**.
>
> Oriente de Rio de Janeiro, 2 de outubro de 2026.
>
> ________________ Venerável Mestre  ·  ________________ Secretário
>
> Nº CP-2026-0001 · Verifique em sigmahorus.com.br/verificar/K7Q2-9XMA [QR]

Quem assina: os **titulares atuais** dos cargos Venerável Mestre e Secretário (vêm de
Cargos/Veneralato). Com **assinatura digitalizada** ou só o nome impresso, a decidir (seção 8).

### 6.2 Modelos de diploma

O dono pediu "modelos de diplomas maçônicos". Três caminhos:

| Opção | Como é | Prós | Contras |
|---|---|---|---|
| **A. Modelos prontos do sistema** | 2 ou 3 layouts desenhados por nós (ex.: **Clássico**, com moldura dourada dupla e brasão; **Pergaminho**, com fundo papiro, o tema já usado na plataforma; **Sóbrio**, preto e branco para imprimir) | funciona na hora; mesmo padrão visual do sistema | todas as lojas com cara parecida |
| **B. Arte própria da loja** | a loja sobe uma imagem de fundo A4 paisagem (a moldura/arte dela) e o sistema escreve o texto por cima, numa área fixa | a loja usa o diploma que já tem | a arte precisa deixar o miolo livre; exige teste com cada arte |
| **C. A + B** | começa com os prontos e permite subir fundo próprio | flexível | mais trabalho (fase 2 do certificado) |

**Recomendação: C em etapas.** Primeiro os modelos prontos (Clássico + Pergaminho); a arte
própria da loja entra depois.

### 6.3 Como o PDF é gerado

O certificado precisa ir **anexado ao e-mail**, então o PDF é montado **no servidor**:

- Biblioteca **`pdf-lib`** (JavaScript puro, roda na Vercel sem navegador), com fontes clássicas
  embutidas, de licença livre (ex.: **Cinzel** para os títulos e **EB Garamond** para o texto),
  brasão da loja e QR de verificação.
- **Descartado:** Chrome/Puppeteer no servidor. Pesado para a Vercel e sujeito a limites.
- **A prévia na tela é o próprio PDF que será enviado** (o mesmo arquivo, num visualizador), no
  mesmo princípio da convocação: o que se vê é o que sai.

### 6.4 Tela "Social → Certificados de presença"

1. Lista das sessões **já realizadas** que têm visitantes, com a contagem de "3 visitantes · 1
   certificado enviado".
2. Ao abrir uma sessão:
   - a tabela de visitantes, com a situação de cada certificado;
   - a escolha do modelo;
   - **"Revisar certificados"**, que mostra os PDFs, e **"Enviar por e-mail"** (um ou todos os
     pendentes).
   - **Travas:**
     - só depois do término da sessão;
     - visitante sem e-mail fica de fora, com aviso ("baixe o PDF e entregue em mãos");
     - o mesmo certificado não é reenviado sem confirmação.
3. Também dá para **baixar o PDF** e **reenviar**.
4. **E-mail:** assunto "Certificado de presença — Sessão de 01/10/2026 — ARLS Tim Maia", com
   uma mensagem curta de agradecimento, o PDF anexo e o link de verificação.

### 6.5 Verificação pública

Página **/verificar/[código]**, sem login: mostra "Certificado válido — nº, irmão, loja
visitada, data da sessão". Evita certificado falsificado e dá credibilidade ao documento.
Mostra o mínimo de dados (nome, loja e data; sem e-mail).

## 7. Permissões

| Ação | Quem |
|---|---|
| Imprimir livro e lista de visitantes, cadastrar visitantes | quem já gerencia Sessões (Secretário, Venerável, Administrador) |
| Certificados (aba Social) | quem tem o recurso **social** com escrita; hoje a aba é só de leitura para vários cargos, então escrever certificados precisa de permissão explícita. Proposta: Secretário, Venerável, Administrador |

## 8. Decisões em aberto (para o dono)

1. **Modelos de diploma:** A (prontos), B (arte própria) ou C (A agora, B depois)? *Recomendo C.*
2. **Assinaturas no certificado:** nome impresso dos titulares ou **assinatura digitalizada**
   (o Venerável e o Secretário sobem uma imagem da assinatura)? *Recomendo começar com a digitalizada opcional: se não houver imagem, só o nome.*
3. **Campos da lista de visitantes:** incluir **Grau** e **Oriente** além do pedido (nome, loja,
   Potência, e-mail)? Incluir **CIM** e **telefone**? *Recomendo Grau e Oriente sim; CIM e telefone opcionais.*
4. **Livro de presença:** ordem alfabética simples, por grau ou cargos em loja primeiro? Quantas
   linhas em branco? Levar a ordem do dia no cabeçalho?
5. **Certificado também para membros da própria loja?** (ex.: sessão magna). *Recomendo não por agora.*
6. **Envio:** só manual pelo botão (recomendado) ou automático no dia seguinte à sessão?
7. **Verificação pública com QR:** sim (recomendado) ou não?

## 9. Fases de execução

| Fase | Entrega | Migration | Esforço |
|---|---|---|---|
| **1** | Livro de presença dos membros (impressão) + lista de visitantes em branco (impressão) | não | pequeno |
| **2** | Cadastro de visitantes (aba na sessão + Secretaria → Visitantes), reimpressão da lista preenchida, LGPD (consentimento, exclusão) | sim (`Visitor`, `SessionVisitor`) | médio |
| **3** | Certificado: modelos prontos, PDF no servidor (`pdf-lib` + fontes), numeração, prévia, envio por e-mail, verificação pública | sim (campos do certificado) | médio-grande |
| **4** | Arte própria da loja como fundo do diploma + assinaturas digitalizadas | sim (arquivos no R2) | médio |

Cada fase é publicada e testada antes da seguinte. As fases 2 e 3 têm migration, que deve ser
**aplicada no banco antes do deploy** (lição da convocação).

## 10. Riscos e cuidados

- **Dados de não membros (LGPD):** coletar só o necessário, com consentimento na folha; usar
  apenas para o certificado; permitir excluir.
- **E-mail digitado errado a partir da letra do visitante:** a prévia mostra o destinatário, e o
  Secretário pode corrigir antes de enviar. Falha de envio fica registrada, com opção de reenviar.
- **Nome da Potência/Loja do visitante em texto livre:** o certificado reproduz o que foi
  digitado; a prévia existe para pegar erro de grafia.
- **Graus:** o certificado cita os graus trabalhados na sessão. Um visitante Aprendiz numa
  sessão de 1º e 2º grau esteve só na parte de Aprendiz, por isso o certificado usa o
  **grau em que ele esteve**, informado no cadastro da visita.
