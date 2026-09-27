// Pix agrupado do Asaas: o irmão paga várias pendências com UMA cobrança no Asaas. Todas as
// Invoices do grupo guardam o mesmo asaasPaymentId, e a cobrança vai com externalReference
// "grp:<id>" (o webhook sabe que precisa dividir). Regras puras aqui; rede e banco em
// lib/asaas-group-server.ts.

export const GROUP_REF_PREFIX = 'grp:';

export function isGroupRef(ref: string | null | undefined): boolean {
  return Boolean(ref && ref.startsWith(GROUP_REF_PREFIX));
}

export interface GroupItem {
  invoiceId: string;
  /** Quanto ainda falta nesta conta/cobrança (a ordem da lista é a ordem de quitação). */
  open: number;
}

export interface GroupAllocation {
  invoiceId: string;
  amount: number;
  /** Líquido da parte (valor − tarifa proporcional); null se o Asaas não informou o líquido. */
  netValue: number | null;
}

const cents = (n: number) => Math.round(n * 100);

/**
 * Divide o valor recebido entre as cobranças, na ordem (a mais antiga primeiro): cada uma
 * leva até o que falta nela; a ÚLTIMA leva o que sobrar (se o irmão pagou a mais, fica
 * registrado nela, em vez de sumir). A tarifa do Asaas (valor − líquido) é rateada na
 * proporção de cada parte, com o arredondamento na última — a soma bate em centavos.
 */
export function allocateGroupPayment(items: GroupItem[], total: number, netValue: number | null): GroupAllocation[] {
  if (items.length === 0 || total <= 0) return [];
  const totalC = cents(total);
  let remaining = totalC;
  const parts: { invoiceId: string; c: number }[] = [];
  items.forEach((it, i) => {
    const last = i === items.length - 1;
    const take = last ? remaining : Math.min(Math.max(cents(it.open), 0), remaining);
    remaining -= take;
    if (take > 0) parts.push({ invoiceId: it.invoiceId, c: take });
  });

  const feeC = netValue == null ? null : Math.max(0, totalC - cents(netValue));
  let feeLeft = feeC ?? 0;
  return parts.map((p, i) => {
    let net: number | null = null;
    if (feeC != null) {
      const fee = i === parts.length - 1 ? feeLeft : Math.round((feeC * p.c) / totalC);
      feeLeft -= fee;
      net = (p.c - fee) / 100;
    }
    return { invoiceId: p.invoiceId, amount: p.c / 100, netValue: net };
  });
}
