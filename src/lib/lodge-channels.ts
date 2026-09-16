import { decryptSecret } from '@/lib/crypto';
import type { LodgeChannels } from '@/lib/messaging';

// Campos de mensageria da loja (BYO WhatsApp/SMS) + identidade visual (nome e
// brasão), usados pra montar o cabeçalho HTML do e-mail em lib/messaging.ts.
export interface LodgeMessagingRow {
  name?: string | null;
  crestUrl?: string | null;
  whatsappPhoneId?: string | null;
  whatsappTokenEnc?: string | null;
  whatsappTemplate?: string | null;
  whatsappTemplateLang?: string | null;
  smsAccountSid?: string | null;
  smsAuthTokenEnc?: string | null;
  smsFrom?: string | null;
}

export const LODGE_MESSAGING_SELECT = {
  name: true,
  crestUrl: true,
  whatsappPhoneId: true,
  whatsappTokenEnc: true,
  whatsappTemplate: true,
  whatsappTemplateLang: true,
  smsAccountSid: true,
  smsAuthTokenEnc: true,
  smsFrom: true,
} as const;

// Constrói a config de canais (descriptografando os tokens) a partir do registro da loja.
export function buildLodgeChannels(lodge: LodgeMessagingRow | null): LodgeChannels {
  const waToken = decryptSecret(lodge?.whatsappTokenEnc);
  const smsToken = decryptSecret(lodge?.smsAuthTokenEnc);
  return {
    whatsapp: waToken && lodge?.whatsappPhoneId
      ? { token: waToken, phoneId: lodge.whatsappPhoneId, template: lodge.whatsappTemplate, lang: lodge.whatsappTemplateLang }
      : null,
    sms: smsToken && lodge?.smsAccountSid && lodge?.smsFrom
      ? { sid: lodge.smsAccountSid, token: smsToken, from: lodge.smsFrom }
      : null,
    lodgeName: lodge?.name ?? null,
    crestUrl: lodge?.crestUrl ?? null,
  };
}
