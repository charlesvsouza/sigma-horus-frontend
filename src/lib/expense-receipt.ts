// Comprovante de pagamento de uma DESPESA (conta a pagar). Mesma técnica do "Já paguei" das
// mensalidades: o arquivo vai para o storage privado (`payment-receipts/<loja>/…`) e a
// referência fica num registro de auditoria — sem coluna nova. O mais recente vale.
export const EXPENSE_RECEIPT_ENTITY = 'expense-receipt';
/** Registro de remoção: encerra o comprovante anterior sem apagar o histórico. */
export const EXPENSE_RECEIPT_REMOVED_ENTITY = 'expense-receipt-removed';

export interface ExpenseReceiptMeta { receiptKey: string; receiptName: string; receiptType: string }

interface Row { createdAt: Date; after: string | null }

/** Comprovante vigente: o último anexado, a menos que uma remoção seja mais nova. */
export function currentExpenseReceipt(attached: Row[], removed: { createdAt: Date }[]): ExpenseReceiptMeta | null {
  const sorted = [...attached].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  for (const row of sorted) {
    if (removed.some((r) => r.createdAt.getTime() >= row.createdAt.getTime())) return null;
    try {
      const meta = JSON.parse(row.after ?? '{}') as Partial<ExpenseReceiptMeta>;
      if (meta.receiptKey) return { receiptKey: meta.receiptKey, receiptName: meta.receiptName ?? 'comprovante', receiptType: meta.receiptType ?? '' };
    } catch { /* registro sem metadados legíveis */ }
  }
  return null;
}
