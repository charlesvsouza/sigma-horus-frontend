-- Tipo de baixa do pagamento (como foi confirmado: Asaas, comprovante, extrato, dinheiro, manual, importação).
-- Coluna nova e anulável: só descritiva, não muda saldo nem relatório de valores. Os pagamentos antigos são
-- classificados pela forma e pela observação (mesma regra de lib/settlement-type.ts); doação, custeio, tarifa e
-- estorno do Asaas ficam sem tipo (não são baixa de conta).
ALTER TABLE "Payment" ADD COLUMN "settlementType" TEXT;

UPDATE "Payment" SET "settlementType" = 'asaas_auto' WHERE "method" = 'asaas';
UPDATE "Payment" SET "settlementType" = 'cash' WHERE "method" IN ('asaas-cash', 'cash');
UPDATE "Payment" SET "settlementType" = 'import' WHERE "method" = 'import';
UPDATE "Payment" SET "settlementType" = 'receipt_check'
 WHERE "settlementType" IS NULL AND "method" NOT IN ('donation', 'fund', 'asaas-fee', 'asaas-refund')
   AND "note" ILIKE '%conferido pelo comprovante%';
UPDATE "Payment" p SET "settlementType" = 'bank_statement'
 WHERE p."settlementType" IS NULL AND p."method" NOT IN ('donation', 'fund', 'asaas-fee', 'asaas-refund')
   AND EXISTS (SELECT 1 FROM "BankTransaction" b WHERE b."matchedPaymentId" = p."id");
UPDATE "Payment" SET "settlementType" = 'manual_other'
 WHERE "settlementType" IS NULL AND "method" NOT IN ('donation', 'fund', 'asaas-fee', 'asaas-refund');
