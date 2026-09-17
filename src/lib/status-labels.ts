// Rótulos em PT-BR pros valores de status guardados em inglês no banco (Account,
// Invoice, MessageLog/SendStatus) — usar {LABEL[x] ?? x} em vez do valor cru.

export const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Paga',
  cancelled: 'Cancelada',
  canceled: 'Cancelada',
};

export const MESSAGE_STATUS_LABEL: Record<string, string> = {
  queued: 'Na fila',
  sent: 'Enviada',
  failed: 'Falhou',
};

export const DOCUMENT_KIND_LABEL: Record<string, string> = {
  document: 'Documento',
  minutes: 'Ata',
  certificate: 'Certificado',
  receipt: 'Comprovante',
};

export const SESSION_TYPE_LABEL: Record<string, string> = {
  ordinary: 'Ordinária',
  magnificent: 'Magna',
  emergency: 'Extraordinária',
  other: 'Outra',
};
