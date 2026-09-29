// Conferência do comprovante de Pix anexado ao "Já paguei" (Modo Loja). Não depende dos rótulos
// de cada banco ("Identificador", "ID da transação"…): procura no texto o identificador que o
// PRÓPRIO sistema pôs no QR (txid = id da conta no portal, nº da cobrança no WhatsApp), o número de controle do Pix no formato oficial
// do Banco Central (EndToEndId), o valor e o CNPJ/chave da loja. Comprovante pode ser editado —
// por isso o resultado só HABILITA a baixa de um clique; quem confirma é a Tesouraria.

export interface ReceiptExpectation {
  /** txids aceitos (id da conta e nº da cobrança — ver receiptTxids; no Pix agrupado, os de todas as contas). */
  txids: string[];
  /** Valor esperado (saldo da conta, ou o total do Pix agrupado). */
  amount: number;
  lodgeCnpj?: string | null;
  lodgePixKey?: string | null;
}

export interface ReceiptCheck {
  status: 'conferido' | 'divergente' | 'ilegivel';
  txid: boolean;
  amount: boolean;
  payee: boolean;
  /** Número de controle do Pix (EndToEndId), se achado. */
  e2e: string | null;
  /** Data/hora do pagamento no comprovante (ISO), se achada. */
  paidAt: string | null;
  amountsFound: number[];
}

const digits = (s: string) => s.replace(/\D/g, '');
const alnumLower = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** EndToEndId: "E" + ISPB (8 dígitos) + AAAAMMDDHHMM (12) + 11 alfanuméricos = 32 caracteres. */
const E2E_RE = /\bE\d{8}(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])[0-5]\d[A-Za-z0-9]{11}\b/;

/** Valores em reais escritos no comprovante ("R$ 1.234,56"). */
export function amountsInText(text: string): number[] {
  return [...text.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/g)].map((m) => Number(`${m[1].replace(/\./g, '')}.${m[2]}`));
}

/** Primeira data com hora ("27/09/2026 - 23:45:17" ou "27/09/2026 23:45"), em Brasília → ISO. */
export function paidAtInText(text: string): string | null {
  const m = text.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\s*(?:-|às|as)?\s*(\d{2}):(\d{2})(?::(\d{2}))?/i);
  if (m) {
    const [, d, mo, y, h, mi, s] = m;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}-03:00`;
    return Number.isNaN(new Date(iso).getTime()) ? null : new Date(iso).toISOString();
  }
  const only = text.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
  if (!only) return null;
  const iso = `${only[3]}-${only[2]}-${only[1]}T12:00:00-03:00`;
  return Number.isNaN(new Date(iso).getTime()) ? null : new Date(iso).toISOString();
}

/**
 * Identificadores aceitos no comprovante: o id da conta (Pix do portal) e o número da cobrança
 * (Pix enviado pelo WhatsApp). O txid do Pix estático só guarda letras e números, até 25.
 */
export function receiptTxids(accountIds: string[], invoiceNumbers: string[]): string[] {
  return [...accountIds, ...invoiceNumbers.map((n) => n.replace(/[^A-Za-z0-9]/g, '').slice(0, 25))].filter((t) => t.length > 0);
}

export function checkReceipt(text: string, expected: ReceiptExpectation): ReceiptCheck {
  const clean = text ?? '';
  if (clean.replace(/\s/g, '').length < 20) {
    return { status: 'ilegivel', txid: false, amount: false, payee: false, e2e: null, paidAt: null, amountsFound: [] };
  }
  const flat = alnumLower(clean);
  const txid = expected.txids.some((t) => {
    const id = alnumLower(t).slice(0, 25);
    return id.length >= 8 && flat.includes(id);
  });
  const amountsFound = amountsInText(clean);
  const cents = Math.round(expected.amount * 100);
  const amount = amountsFound.some((a) => Math.round(a * 100) === cents);

  const cnpj = digits(expected.lodgeCnpj ?? '');
  const byCnpj = cnpj.length === 14 && digits(clean).includes(cnpj);
  const key = (expected.lodgePixKey ?? '').trim().toLowerCase();
  const byKey = key.length >= 5 && (key.includes('@') ? clean.toLowerCase().includes(key) : digits(key).length >= 10 && digits(clean).includes(digits(key)));
  const payee = byCnpj || byKey;

  const e2e = clean.match(E2E_RE)?.[0] ?? null;
  const paidAt = paidAtInText(clean);
  const status = txid && amount && payee && e2e ? 'conferido' : 'divergente';
  return { status, txid, amount, payee, e2e, paidAt, amountsFound };
}
