// Camada de envio externo. E-MAIL é provido pela PLATAFORMA (Resend, via env).
// WhatsApp e SMS são BYO por loja: cada loja conecta a própria conta (credenciais
// criptografadas por tenant — ver lib/lodge-channels), e o custo é direto dela.
//
//   - E-mail:    Resend     → RESEND_API_KEY, RESEND_FROM (plataforma)
//   - WhatsApp:  Meta Cloud → token/phoneId da loja (proativo exige template aprovado)
//   - SMS:       Twilio     → sid/token/from da loja

export type Channel = 'email' | 'whatsapp' | 'sms';
export type SendStatus = 'sent' | 'queued' | 'failed';
export interface SendResult { status: SendStatus; detail?: string }

export interface WhatsAppCfg { token: string; phoneId: string; template?: string | null; lang?: string | null }
export interface SmsCfg { sid: string; token: string; from: string }
export interface LodgeChannels { whatsapp: WhatsAppCfg | null; sms: SmsCfg | null }

export const EMPTY_CHANNELS: LodgeChannels = { whatsapp: null, sms: null };

const onlyDigits = (s: string) => s.replace(/\D/g, '');

// Normaliza telefone BR para E.164 (+55...). Aceita já com DDI.
function toE164(phone: string): string | null {
  const d = onlyDigits(phone);
  if (!d) return null;
  if (d.startsWith('55') && d.length >= 12) return `+${d}`;
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  return `+${d}`;
}

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

async function sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { status: 'queued', detail: 'E-mail não configurado na plataforma.' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text: body }),
    });
    if (!res.ok) return { status: 'failed', detail: `Resend ${res.status}` };
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', detail: String(e) };
  }
}

async function sendWhatsApp(to: string, body: string, cfg: WhatsAppCfg): Promise<SendResult> {
  const e164 = toE164(to);
  if (!e164) return { status: 'failed', detail: 'Telefone inválido.' };
  const lang = cfg.lang || 'pt_BR';
  // Proativo (fora da janela de 24h) exige template aprovado de corpo com 1 variável.
  const payload = cfg.template
    ? {
        messaging_product: 'whatsapp',
        to: e164.replace('+', ''),
        type: 'template',
        template: { name: cfg.template, language: { code: lang }, components: [{ type: 'body', parameters: [{ type: 'text', text: body }] }] },
      }
    : { messaging_product: 'whatsapp', to: e164.replace('+', ''), type: 'text', text: { body } };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { status: 'failed', detail: `WhatsApp ${res.status}${cfg.template ? '' : ' (proativo exige template)'} ${detail.slice(0, 200)}` };
    }
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', detail: String(e) };
  }
}

async function sendSms(to: string, body: string, cfg: SmsCfg): Promise<SendResult> {
  const e164 = toE164(to);
  if (!e164) return { status: 'failed', detail: 'Telefone inválido.' };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: e164, From: cfg.from, Body: body }),
    });
    if (!res.ok) return { status: 'failed', detail: `Twilio ${res.status}` };
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', detail: String(e) };
  }
}

/** Envia por um canal. `to` = e-mail (email) ou telefone (whatsapp/sms). WhatsApp/SMS usam as credenciais da loja. */
export async function dispatch(channel: Channel, to: string, subject: string, body: string, ch: LodgeChannels): Promise<SendResult> {
  if (!to) return { status: 'failed', detail: 'Destinatário sem contato.' };
  if (channel === 'email') return sendEmail(to, subject, body);
  if (channel === 'whatsapp') return ch.whatsapp ? sendWhatsApp(to, body, ch.whatsapp) : { status: 'queued', detail: 'WhatsApp não conectado nesta loja.' };
  return ch.sms ? sendSms(to, body, ch.sms) : { status: 'queued', detail: 'SMS não conectado nesta loja.' };
}

/** Canais disponíveis: e-mail pela plataforma; WhatsApp/SMS conforme a loja conectou. */
export function channelsAvailable(ch: LodgeChannels): Record<Channel, boolean> {
  return { email: emailConfigured(), whatsapp: Boolean(ch.whatsapp), sms: Boolean(ch.sms) };
}
