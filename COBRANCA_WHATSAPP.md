# Cobrança pelo WhatsApp (Modo Loja) — análise e plano

> Status: **Fase 1 implementada** (2026-09-28, ainda não publicada). Decisões finais:
> - não é automático ao gerar (o `wa.me` exige um clique por mensagem): atalho "Enviar pelo WhatsApp"
>   logo após criar cobrança avulsa + **página própria** `/dashboard/cobrancas/whatsapp` (fila de
>   envio, filtros a vencer/vencidas, último envio) para massa e recorrentes;
> - texto = o mesmo do lembrete por e-mail (`lib/charge-notice.ts`), com o Pix copia e cola numa
>   linha própria e pedido de comprovante;
> - rota ficou `api/invoices/[id]/whatsapp`; registro `MessageLog` com título `WhatsApp: cobrança <número>`.
> **Escopo: só lojas em Modo Loja** (recebimento direto na chave Pix da loja). O Modo Asaas
> fica como está: já tem link público de pagamento (`asaasInvoiceUrl`) e o próprio Asaas
> notifica o cliente.
>
> Contexto: alguns irmãos não entram na plataforma nem abrem e-mail. O Tesoureiro quer
> mandar a cobrança (ex.: `COB-202609-0043`, irmão Yuri) **direto no WhatsApp dele**, a
> partir da lista de Cobranças, onde hoje só existem **Lembrar** (e-mail) e **Cancelar**.

---

## 1. O que já existe e pode ser reaproveitado

| Peça | Onde | Serve para |
|---|---|---|
| Telefone do irmão | `Member.phone` (texto livre) | destino do WhatsApp |
| Pix estático com valor exato | `buildPixPayload()` em `lib/pix.ts` (BR Code + CRC, testado) | copia e cola na chave da loja |
| Geração de QR em PNG | pacote `qrcode` (já instalado, usado no portal) | imagem do QR |
| Saldo em aberto | `openBalance()` em `lib/portal-dues.ts` | valor certo quando há pagamento parcial |
| Dados bancários da loja | `paymentInstructions()` em `lib/collection.ts` | fallback sem chave Pix |
| Texto de lembrete | `api/invoices/[id]/remind` + `payHint()` | base da mensagem |
| "Já paguei" | aviso do portal (`api/portal/paid-notice-group` e afins) | Fase 2 |
| Registro de envios | `MessageLog` (channel, status, error) | histórico "enviado por WhatsApp em…" |

O portal (`api/portal/accounts/[id]/pay`) já monta, no Modo Loja, o Pix estático com o valor
exato + QR. A lógica existe; falta **entregá-la fora do portal**, pela mão do Tesoureiro.

---

## 2. Achado importante: no celular, o QR é o formato errado

O irmão recebe a mensagem **no próprio celular** — e não dá para escanear um QR que está na
tela do mesmo aparelho. O que funciona é o **Pix copia e cola**: tocar e segurar, copiar,
abrir o app do banco → "Pix copia e cola". O QR só serve se ele vê a mensagem no computador
ou tem outro aparelho.

**Conclusão:** a mensagem leva o **copia e cola como texto** (principal); o QR vai como
imagem opcional (secundário).

---

## 3. Opções de envio

### Opção A — Envio manual assistido (`wa.me`) · **recomendada**
Botão **"WhatsApp"** na linha da cobrança abre `https://wa.me/55DDDNUMERO?text=<mensagem>`:
o WhatsApp (app no celular ou WhatsApp Web no PC) abre **na conversa do irmão com o texto já
escrito**. O Tesoureiro só aperta Enviar, do próprio número.

- **Custo zero, sem Meta, sem chip novo, sem risco de banimento.**
- Sai de um número que o irmão conhece → ele **responde** (bom para quem é resistente).
- Limitação: `wa.me` **só leva texto**, não anexa imagem — por isso o QR vai à parte:
  - **Copiar QR** → PNG na área de transferência (`ClipboardItem image/png`); no WhatsApp Web, `Ctrl+V`.
  - **Compartilhar** (celular) → `navigator.share({ files: [qr.png], text })` → folha nativa
    → WhatsApp, com **imagem + texto juntos**. Só aparece se `navigator.canShare({ files })`.
  - **Baixar QR** → fallback universal.

### Opção B — Página pública de pagamento `/pagar/[token]` · **fase 2**
No Modo Loja **não existe nenhum link de pagamento sem login** — o lembrete manda para o
portal, que o irmão resistente não abre. Uma página pública com QR grande + "Copiar código
Pix" + "Já paguei" deixa a mensagem curta e resolve o QR de vez (ver §6).

### Opção C — WhatsApp oficial (Meta Cloud API) · **futuro, automação**
Código BYO pronto (`lib/messaging.ts`, `CONEXAO_WHATSAPP.md`), parado no cadastro da Meta.
Serviria para disparo automático; não resolve o problema de hoje.

### Opção D — APIs não oficiais (Evolution API, Baileys, WPPConnect, Z-API…) · **não recomendada**
- **Violam os Termos do WhatsApp**; o número da loja pode ser banido sem aviso.
- Exigem **servidor sempre ligado** segurando a sessão (Vercel é serverless → novo serviço
  no Railway, custo e manutenção), pareamento por QR que cai, quebra a cada atualização.
- LGPD: sessão e mensagens do número da loja passando por serviço de terceiro.

---

## 4. Recomendação

**Fase 1 (agora):** A — botão "WhatsApp" + copiar código Pix / copiar, compartilhar e baixar QR.
**Fase 2:** B — página `/pagar/[token]`; a mensagem passa a levar esse link.
**Fase 3 (se a Meta destravar):** C, reaproveitando os mesmos textos.

---

## 5. Especificação da Fase 1

### 5.1 Nova rota — `GET /api/invoices/[id]/share`
Mesmas travas do `remind`: `auth` + `requireLodgeAccess(..., 'accounts', 'write')` + `withTenant`.

- **Loja em Modo Asaas → 409** ("Disponível apenas no Modo Loja"). O botão nem aparece nesse
  modo; a trava no servidor é só defesa.
- Cobrança paga/cancelada → 409.
- Valor = **saldo em aberto** (`openBalance`, descontando pagamentos parciais). Saldo zero → 409.
- Com chave Pix: `buildPixPayload({ key: lodge.pixKey, name, city, amount: saldo, txid: invoice.number })`
  + `QRCode.toDataURL(payload)`.
- Sem chave Pix: texto com os dados bancários (`paymentInstructions`), sem QR, e aviso na UI
  "Cadastre a chave Pix em Configurações da loja para enviar o Pix pronto".

Resposta:
```ts
{
  phone: string | null;        // 55DDDNUMERO normalizado, ou null
  text: string;                // mensagem pronta
  pixCopyPaste: string | null;
  qrDataUrl: string | null;    // data:image/png;base64,...
  amount: number;              // saldo em aberto usado no Pix
}
```

### 5.2 Mensagem — `lib/whatsapp-share.ts` (puro, testável)
```
Olá, Yuri!
Aqui é a Tesouraria da ARLS Tim Maia.

Cobrança COB-202609-0043 — Mensalidade de setembro
Valor: R$ 120,00 · Vencimento: 10/10/2026

Para pagar, copie o código abaixo e cole no app do seu banco em "Pix copia e cola":

00020126580014br.gov.bcb.pix...

Depois de pagar, é só responder esta mensagem com o comprovante. T.F.A.
```
- Código Pix **sozinho numa linha**, sem `*negrito*` em volta (o asterisco iria junto na cópia).
- Pedir o comprovante na conversa: no Modo Loja a baixa é manual, e isso fecha o ciclo com o Tesoureiro.
- Saudação/assinatura configuráveis pela loja ficam para depois.

### 5.3 Telefone — `normalizeWhatsAppPhone()` no mesmo arquivo
`Member.phone` é texto livre. Só dígitos; 10–11 dígitos → prefixa `55`; 12–13 começando com
`55` → mantém; o resto → `null`. Sem telefone válido, o botão ainda funciona: abre
`https://wa.me/?text=...` (o Tesoureiro escolhe o contato) com aviso "Irmão sem celular cadastrado".
Testes: `(21) 99999-0000`, `21999990000`, `+55 21 99999-0000`, fixo de 10 dígitos, vazio, lixo.

### 5.4 UI — `CobrancasClient.tsx`
Só quando `collection.mode === 'lodge'` e a cobrança não está paga: botão **WhatsApp** ao lado
de **Lembrar** (este passa a ter o título "Lembrar por e-mail"). Ao clicar, diálogo pequeno com:
- prévia do texto num `textarea` (editável);
- **Abrir no WhatsApp** (principal) → `window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text))`;
- **Copiar código Pix** · **Copiar QR** · **Compartilhar** (se suportado) · **Baixar QR**;
- miniatura do QR e o valor usado ("Saldo em aberto: R$ …").

### 5.5 Registro
Ao clicar "Abrir no WhatsApp", `POST /api/invoices/[id]/share` grava um `MessageLog`
(`channel: 'whatsapp-manual'`, `status: 'handed-off'`, `memberId`, título "Cobrança COB-…
enviada pelo WhatsApp"). Não dá para saber se ele apertou Enviar — o status deixa isso claro.
Serve para o Tesoureiro ver "já mandei pro Yuri dia 28". Sem migration (texto livre).

### 5.6 Documentação
- Manual (`manual-book.tsx`), seção Cobranças: botão WhatsApp (só Modo Loja), dica do copia e cola.
- `sigmahorus_documentacao.md` + entrada no topo do histórico de desenvolvimento.

### 5.7 Critério de pronto
- Cobrança do Yuri numa loja Modo Loja → clique → WhatsApp Web abre na conversa certa com o
  texto → código colado no app do banco é aceito, com a chave e o valor certos.
- Loja Modo Asaas: botão não aparece; rota responde 409.
- Testes de `normalizeWhatsAppPhone` e do montador de mensagem.
- Checklist do CI: `tsc` + `eslint` + `npm test` + `prisma validate`.

---

## 6. Especificação resumida da Fase 2 (`/pagar/[token]`, só Modo Loja)
- `lib/pay-link-token.ts`: assina/verifica `{ invoiceId, lodgeId, exp }` com HMAC e segredo
  próprio (ex.: `PAY_LINK_SECRET`), mesmo padrão de `lib/email-change-token.ts`.
- Página pública fora do `dashboard`, via `prismaAdmin`, só campos mínimos (primeiro nome,
  número, valor, vencimento, nome da loja — nada de CPF). 404 genérico para token inválido/expirado;
  "Esta cobrança já foi paga" quando paga.
- QR grande + "Copiar código Pix" + "Já paguei" (reaproveita o aviso do portal; com rate limit).
- `noindex` e `Referrer-Policy: no-referrer`.
- O `payHint()` do Modo Loja (lembrete por e-mail e automático) também passa a usar esse link.

---

## 7. Riscos e cuidados
- **Pix estático não dá baixa automática** — continua manual (extrato, comprovante no
  WhatsApp ou "Já paguei"). Deixar isso claro na UI.
- **Valor muda com pagamento parcial** — a rota sempre recalcula o saldo na hora; não guardar o código.
- **Número de quem envia:** a mensagem sai do WhatsApp do Tesoureiro. A loja pode usar um
  WhatsApp Business próprio no celular da Tesouraria.
- **LGPD:** cobrança da loja ao próprio irmão é execução de obrigação/legítimo interesse; não
  usar o recurso para outros fins.

## 8. Esforço estimado
- Fase 1: pequeno — 1 rota (GET + POST de registro), 1 lib pura com testes, 1 diálogo, manual.
- Fase 2: médio — token, página pública, rate limit, ajuste do `payHint`.
