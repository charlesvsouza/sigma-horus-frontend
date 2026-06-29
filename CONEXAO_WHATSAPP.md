# Conexão de Comunicação — WhatsApp (Meta) e SMS (Twilio)

> Guia operacional para **conectar os canais de mensagem por loja** (modelo BYO — cada loja usa a própria conta e paga o próprio custo). A tela fica em **Administração → Integrações → Comunicação (WhatsApp / SMS)**.
>
> O **e-mail** já é provido pela plataforma (Resend) e não precisa de configuração. Este guia cobre WhatsApp e SMS.

---

## Como o sistema envia (importante)

O Sigma Horus envia mensagens **proativas** (aniversários, jubileus, lembretes de cobrança, convocações de campanha). Mensagens proativas no WhatsApp, fora da janela de 24h, **exigem um template aprovado pela Meta**, com o **corpo contendo exatamente 1 variável** (`{{1}}`). O texto real do aviso é injetado nessa variável.

Referência no código: `src/lib/messaging.ts` (`WhatsAppCfg = { token, phoneId, template, lang }`, `SmsCfg = { sid, token, from }`) e `src/lib/lodge-channels.ts` (descriptografa as credenciais por loja). Campos da UI em `src/app/dashboard/integracoes/page.tsx`.

---

## WhatsApp (Meta Cloud API)

A tela pede **4 campos**: `Phone Number ID`, `Token (System User)`, `Nome do template`, `Idioma do template (pt_BR)`.

### A. Contas (uma vez)
1. Tenha uma conta no **Facebook/Meta**.
2. Crie um **Meta Business** em **business.facebook.com** (Meta Business Suite) — a "empresa" dona do WhatsApp.

### B. Criar o app e adicionar o WhatsApp
1. **developers.facebook.com → My Apps → Create App**.
2. Tipo **Business** → nome (ex.: "Sigma Horus – Loja X") → vincule ao Business.
3. Em **Add products**, adicione **WhatsApp → Set up**. Isso cria a **WhatsApp Business Account (WABA)**.

### C. Número de envio + Phone Number ID
1. Em **WhatsApp → API Setup** há um **número de teste** (bom pra validar) e o **Phone Number ID** abaixo do "From". → campo **Phone Number ID**.
2. Produção: **Add phone number** → cadastre o **número real da loja** (não pode estar em uso no WhatsApp comum; verificação por SMS/ligação). Use o **Phone Number ID desse número**.

### D. Token permanente (System User)
O token da API Setup é **temporário (24h)**. Gere um permanente:
1. **business.facebook.com → Configurações do negócio → Usuários → Usuários do sistema**.
2. **Adicionar** → System User com papel **Admin**.
3. **Atribuir ativos** → vincule o **app** e a **WABA** (acesso total).
4. **Gerar novo token** → selecione o app → permissões **`whatsapp_business_messaging`** e **`whatsapp_business_management`** → expiração **Nunca**.
5. Copie o token (aparece só uma vez). → campo **Token (System User)**.

### E. Criar e aprovar o template
1. **WhatsApp Manager → Modelos de mensagem (Templates) → Criar modelo**.
2. Categoria **Utilidade (Utility)**, idioma **Português (BR)**.
3. **Nome:** ex.: `aviso_loja` (minúsculas/números/underscore). → campo **Nome do template**.
4. **Corpo:** exatamente **1 variável** `{{1}}`. Ex.: `Loja Maçônica: {{1}}`.
5. Enviar para aprovação (minutos a poucas horas).
6. Idioma na tela: **`pt_BR`**.

### F. Conectar no Sigma Horus
**Integrações → WhatsApp (Meta Cloud API):** cole **Phone Number ID**, **Token**, **Nome do template** (`aviso_loja`), **Idioma** (`pt_BR`) → **Conectar WhatsApp**. Credenciais ficam **criptografadas e isoladas por loja**.

### ⚠️ Atenção
- **Nome do template e idioma** precisam bater **exatamente** com o aprovado.
- O corpo **tem que ter `{{1}}`** — sem variável, o envio falha.
- Conta nova começa com **limite (tier 250/dia)** e pode exigir **verificação do negócio** para subir limites e liberar o número real.
- Sem conexão/aprovação, as mensagens ficam **enfileiradas** no histórico de Comunicação e saem quando tudo estiver no ar.

---

## SMS (Twilio) — alternativa/reserva

A tela pede **3 campos**: `Account SID`, `Auth Token`, `Número remetente (+55...)`.

1. **Criar conta:** twilio.com/try-twilio → verificar e-mail e celular.
2. **Account SID + Auth Token:** Console (console.twilio.com) → bloco **Account Info** (SID começa com `AC...`; "Show" revela o token).
3. **Número remetente:** Console → **Phone Numbers → Buy a number** com capacidade **SMS** (envio para o Brasil costuma exigir *Regulatory Bundle*); ou **Messaging Service / Sender ID alfanumérico** (exige pré-registro). Formato **E.164**: `+55` + DDD + número.
4. **Sair do trial:** conta trial só envia para números verificados e adiciona aviso; faça **upgrade** (adicione crédito) em Billing.
5. **Conectar:** Integrações → SMS (Twilio) → SID, Auth Token, Número remetente → **Conectar SMS**.

> 💡 Para o Brasil, o **WhatsApp tende a ser mais barato, confiável e bem recebido** que SMS. Priorize WhatsApp; deixe o SMS como reserva.

---

## Estado atual (2026-06-28)
- Código e UI prontos para os dois canais (BYO por loja); e-mail (Resend) **ativo**.
- **Pendente:** concluir o cadastro na **Meta** (app, número, token permanente e template aprovado) — em andamento.
- Próximo passo ao retomar: terminar o template `aviso_loja` aprovado, conectar em Integrações e testar por uma convocação de campanha ou gatilho diário.
