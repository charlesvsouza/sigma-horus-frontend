import type { PixQr, ProviderChargeStatus } from '@/lib/billing-provider';

/**
 * Pix no padrão do Bacen (cobrança imediata + QR), compartilhado entre bancos.
 *
 * O Pix é a parte padronizada: o contrato é o mesmo em Itaú, BB, Bradesco, Sicoob e por aí.
 * O que muda de banco para banco é a AUTENTICAÇÃO (OAuth2 com certificado, API key) e os
 * cabeçalhos. Por isso este módulo recebe uma função `chamar` já autenticada: quem sabe falar
 * com o banco é o adaptador do banco, e aqui só mora o que é igual em todos.
 *
 * Assim, homologar o Pix do segundo banco vira: uma entrada no catálogo (`bank-catalog`),
 * o caminho do token e a função de autenticação. Nada de reescrever cobrança e QR.
 */

export interface PixResponse {
  status: number;
  body: unknown;
}

/** Chamada autenticada ao banco: o adaptador resolve token, certificado e cabeçalhos. */
export type PixCaller = (method: 'GET' | 'PUT' | 'POST', path: string, body?: unknown) => Promise<PixResponse>;

export interface PixCobInput {
  /** Valor em reais (o corpo vai com duas casas). */
  value: number;
  description: string | null;
  /** Chave Pix da loja que recebe. */
  pixKey: string;
  txid: string;
}

/** txid do Pix: 26 a 35 caracteres alfanuméricos (regra do Bacen), derivado do id da cobrança. */
export function sanitizeTxid(invoiceId: string): string {
  const base = invoiceId.replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 35);
  return base.length >= 26 ? base : base.padEnd(26, '0');
}

export function buildPixCobBody(input: { value: number; description: string | null; txid: string; pixKey: string }): Record<string, unknown> {
  return {
    calendario: { expiracao: 3600 * 24 * 3 },
    valor: { original: input.value.toFixed(2) },
    chave: input.pixKey,
    txid: input.txid,
    solicitacaoPagador: (input.description ?? '').slice(0, 140) || undefined,
  };
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
function texto(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** Mensagem do banco em uma linha: "422: motivo". Usada por todos os adaptadores. */
export function mensagemDoBanco(body: unknown, status: number): string {
  const b = obj(body);
  const erro = Array.isArray(b.erro) ? obj(b.erro[0]) : {};
  const detalhe = texto(b.detail) ?? texto(b.mensagem) ?? texto(b.message) ?? texto(erro.mensagem) ?? texto(b.title);
  return `${status}${detalhe ? `: ${detalhe.slice(0, 200)}` : ''}`;
}

/**
 * Traduz a cobrança Pix do banco para a situação do contrato.
 * Contrato do Bacen: `status` = ATIVA | CONCLUIDA | REMOVIDA_PELO_USUARIO_RECEBEDOR | REMOVIDA_PELO_PSP,
 * e `pix[]` traz endToEndId, valor e horário do recebimento.
 */
export function mapearCobrancaPix(body: unknown): ProviderChargeStatus {
  const b = obj(body);
  const status = (texto(b.status) ?? '').toUpperCase();
  const pix = Array.isArray(b.pix) ? obj(b.pix[0]) : {};
  const horario = texto(pix.horario);
  const valor = Number(pix.valor);
  if (status === 'CONCLUIDA') {
    return {
      state: 'paid',
      paidAt: horario ? new Date(horario) : null,
      endToEndId: texto(pix.endToEndId),
      value: Number.isFinite(valor) && valor > 0 ? valor : null,
    };
  }
  if (status === 'ATIVA') return { state: 'open', paidAt: null, endToEndId: null, value: null };
  if (status.startsWith('REMOVIDA')) return { state: 'cancelled', paidAt: null, endToEndId: null, value: null };
  return { state: 'unknown', paidAt: null, endToEndId: null, value: null };
}

export type PixCreateResult =
  | { ok: true; txid: string; raw: unknown }
  | { ok: false; status: number; error: string };

/**
 * Cria (ou substitui) a cobrança imediata com o txid derivado da cobrança do Sigma.
 * `label` é o nome do banco, só para a mensagem de erro ficar clara para o Tesoureiro.
 */
export async function criarCobrancaPix(
  chamar: PixCaller,
  caminhoCob: string,
  input: PixCobInput,
  label: string,
): Promise<PixCreateResult> {
  const res = await chamar('PUT', `${caminhoCob}/${input.txid}`, buildPixCobBody(input));
  if (res.status >= 300) {
    return { ok: false, status: 502, error: `${label} não criou a cobrança Pix (${mensagemDoBanco(res.body, res.status)}).` };
  }
  return { ok: true, txid: input.txid, raw: res.body };
}

/** QR da cobrança já criada; null quando o banco não devolve (aí a tela mostra só o copia e cola vazio). */
export async function buscarQrPix(chamar: PixCaller, caminhoQr: string, txid: string): Promise<PixQr | null> {
  const res = await chamar('GET', caminhoQr.replace('{txid}', txid));
  if (res.status >= 300) return null;
  const b = obj(res.body);
  const payload = texto(b.qrcode);
  if (!payload) return null;
  return { payload, encodedImage: (texto(b.imagemQrcode) ?? '').replace(/^data:image\/png;base64,/, '') };
}
