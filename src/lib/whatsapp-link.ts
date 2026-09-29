// Envio manual assistido pelo WhatsApp (click-to-chat oficial, wa.me): abre a conversa com o
// texto pronto e quem envia é o próprio Tesoureiro. Sem API, sem custo, sem risco de banimento.

/**
 * `Member.phone` é texto livre ("(21) 99999-0000", "+55 21 99999-0000"…). O wa.me quer só
 * dígitos com DDI: 10–11 dígitos (DDD + número) ganham o 55; 12–13 já começando com 55
 * ficam como estão. Qualquer outra coisa → null (o Tesoureiro escolhe o contato na mão).
 */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  return null;
}

/** Link que abre o WhatsApp na conversa do número (ou na escolha de contato, sem número). */
export function whatsAppUrl(phone: string | null, text: string): string {
  return `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`;
}

/** Canal/título do registro em MessageLog — o título carrega o número da cobrança (sem migration). */
export const WHATSAPP_MANUAL_CHANNEL = 'whatsapp-manual';
const TITLE_PREFIX = 'WhatsApp: cobrança ';

export function whatsAppLogTitle(invoiceNumber: string): string {
  return `${TITLE_PREFIX}${invoiceNumber}`;
}

export function invoiceNumberFromLogTitle(title: string): string | null {
  return title.startsWith(TITLE_PREFIX) ? title.slice(TITLE_PREFIX.length) : null;
}

export const WHATSAPP_LOG_TITLE_PREFIX = TITLE_PREFIX;
