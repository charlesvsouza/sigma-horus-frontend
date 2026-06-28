// Camada de envio externo (e-mail / WhatsApp / SMS). Cada canal é ativado por
// variáveis de ambiente; sem elas, o envio fica "queued" (registrado, não
// enviado) — pronto para ativar quando as credenciais forem configuradas.
//
// Providers (sem SDK, via fetch):
//   - E-mail:    Resend     → RESEND_API_KEY, RESEND_FROM
//   - WhatsApp:  Meta Cloud → WHATSAPP_TOKEN, WHATSAPP_PHONE_ID (mensagem
//                proativa exige template aprovado pela Meta; ver Fase 7)
//   - SMS:       Twilio     → TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM

export type Channel = 'email' | 'whatsapp' | 'sms';
export type SendStatus = 'sent' | 'queued' | 'failed';
export interface SendResult { status: SendStatus; detail?: string }

const onlyDigits = (s: string) => s.replace(/\D/g, '');

// Normaliza telefone BR para E.164 (+55...). Aceita já com DDI.
function toE164(phone: string): string | null {
  const d = onlyDigits(phone);
  if (!d) return null;
  if (d.startsWith('55') && d.length >= 12) return `+${d}`;
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  return `+${d}`;
}

async function sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { status: 'queued', detail: 'E-mail não configurado (RESEND_API_KEY/RESEND_FROM).' };
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

async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return { status: 'queued', detail: 'WhatsApp não configurado (WHATSAPP_TOKEN/WHATSAPP_PHONE_ID).' };
  const e164 = toE164(to);
  if (!e164) return { status: 'failed', detail: 'Telefone inválido.' };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: e164.replace('+', ''), type: 'text', text: { body } }),
    });
    if (!res.ok) return { status: 'failed', detail: `WhatsApp ${res.status} (mensagem proativa pode exigir template aprovado)` };
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', detail: String(e) };
  }
}

async function sendSms(to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return { status: 'queued', detail: 'SMS não configurado (TWILIO_*).' };
  const e164 = toE164(to);
  if (!e164) return { status: 'failed', detail: 'Telefone inválido.' };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: e164, From: from, Body: body }),
    });
    if (!res.ok) return { status: 'failed', detail: `Twilio ${res.status}` };
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', detail: String(e) };
  }
}

/** Envia por um canal. `to` = e-mail (email) ou telefone (whatsapp/sms). */
export async function dispatch(channel: Channel, to: string, subject: string, body: string): Promise<SendResult> {
  if (!to) return { status: 'failed', detail: 'Destinatário sem contato.' };
  if (channel === 'email') return sendEmail(to, subject, body);
  if (channel === 'whatsapp') return sendWhatsApp(to, body);
  return sendSms(to, body);
}

/** Canais com provider configurado (para a UI sinalizar o que sai de verdade). */
export function configuredChannels(): Record<Channel, boolean> {
  return {
    email: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM),
    whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
    sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM),
  };
}
