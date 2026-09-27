// Pix estático (BR Code / EMV-QRCPS) do Modo Loja: o irmão paga direto na chave Pix da
// loja, com o valor exato já preenchido. Não há PSP no meio — o sistema não fica sabendo
// do pagamento, então a baixa continua manual (Tesouraria, por extrato ou aviso do irmão).

/** Campo EMV: id (2) + tamanho (2) + valor. */
function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC16-CCITT-FALSE (poli 0x1021, inicial 0xFFFF), exigido pelo campo 63 do BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Só ASCII imprimível sem acento (o tamanho do campo é contado em bytes). */
function ascii(value: string, max: number): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

function isValidCpf(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

/**
 * Normaliza a chave como o DICT espera: e-mail em minúsculas, aleatória (EVP) em
 * minúsculas, CPF/CNPJ só dígitos e telefone em +55DDDNÚMERO. A chave é digitada
 * livre pela Tesouraria ("(21) 99999-0000", "123.456.789-09"), por isso a dedução.
 */
export function normalizePixKey(raw: string): string {
  const key = raw.trim();
  if (key.includes('@')) return key.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return key.toLowerCase();
  const digits = key.replace(/\D/g, '');
  if (key.startsWith('+')) return `+${digits}`;
  if (digits.length === 14) return digits; // CNPJ
  if (digits.length === 13 && digits.startsWith('55')) return `+${digits}`;
  if (digits.length === 11) {
    // 11 dígitos: CPF ou celular com DDD. Máscara de telefone ou CPF inválido → telefone.
    if (/[()]/.test(key) || !isValidCpf(digits)) return `+55${digits}`;
    return digits;
  }
  if (digits.length === 10) return `+55${digits}`; // fixo com DDD
  return key;
}

export interface PixPayloadInput {
  /** Chave Pix da loja (qualquer formato; é normalizada). */
  key: string;
  /** Nome do recebedor (até 25 caracteres). */
  name: string;
  /** Cidade do recebedor (até 15 caracteres). */
  city?: string | null;
  /** Valor exato; omitido = o pagador digita. */
  amount?: number | null;
  /** Identificador do pagamento (até 25 alfanuméricos). Aparece no extrato da loja. */
  txid?: string | null;
}

/** Monta o "Pix copia e cola" (payload do QR Code estático). */
export function buildPixPayload(input: PixPayloadInput): string {
  const merchant = field('00', 'br.gov.bcb.pix') + field('01', normalizePixKey(input.key));
  const txid = (input.txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const name = ascii(input.name, 25) || 'RECEBEDOR';
  const city = ascii(input.city ?? '', 15) || 'BRASIL';

  let payload =
    field('00', '01') +
    field('26', merchant) +
    field('52', '0000') +
    field('53', '986') +
    (input.amount != null && input.amount > 0 ? field('54', input.amount.toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', name) +
    field('60', city) +
    field('62', field('05', txid));
  payload += '6304';
  return payload + crc16(payload);
}
