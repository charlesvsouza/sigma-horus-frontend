-- Reconciliação Asaas + persistência do link de cobrança (sobrevive a reload).
ALTER TABLE "Invoice" ADD COLUMN "asaasPaymentId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "asaasInvoiceUrl" TEXT;
