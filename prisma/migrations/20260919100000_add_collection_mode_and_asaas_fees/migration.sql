-- Modo de recebimento da loja (escolha da própria loja) + tarifa real do Asaas por cobrança.
ALTER TABLE "Lodge" ADD COLUMN "collectionMode" TEXT NOT NULL DEFAULT 'lodge';
ALTER TABLE "Lodge" ADD COLUMN "asaasSettlementAccountId" TEXT;
ALTER TABLE "Lodge" ADD COLUMN "asaasBillingType" TEXT NOT NULL DEFAULT 'PIX';

ALTER TABLE "Invoice" ADD COLUMN "asaasBillingType" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "asaasNetValue" DOUBLE PRECISION;
ALTER TABLE "Invoice" ADD COLUMN "asaasFee" DOUBLE PRECISION;

-- Lojas que já conectaram o Asaas continuam operando nele (Modo Asaas) e recebem, como conta
-- de repasse, a conta bancária comum padrão (ajustável em Configurações da loja).
UPDATE "Lodge" SET "collectionMode" = 'asaas' WHERE "asaasApiKeyEnc" IS NOT NULL;
UPDATE "Lodge" l SET "asaasSettlementAccountId" = (
  SELECT f."id" FROM "FinancialAccount" f
  WHERE f."lodgeId" = l."id" AND f."purpose" = 'general' AND f."active" = true AND f."kind" = 'bank'
  ORDER BY f."isDefault" DESC, f."createdAt" ASC LIMIT 1
) WHERE l."collectionMode" = 'asaas';
