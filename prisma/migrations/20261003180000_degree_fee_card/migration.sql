-- Taxas de grau, Fase 2: cartão de crédito parcelado no Modo Asaas com repasse da tarifa.
ALTER TABLE "Lodge" ADD COLUMN IF NOT EXISTS "degreeFeeCardEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lodge" ADD COLUMN IF NOT EXISTS "cardFeePercentOneTime" DOUBLE PRECISION;
ALTER TABLE "Lodge" ADD COLUMN IF NOT EXISTS "cardFeePercentInstallment" DOUBLE PRECISION;
ALTER TABLE "Lodge" ADD COLUMN IF NOT EXISTS "cardFeeFixed" DOUBLE PRECISION;

ALTER TABLE "DegreeFeePlan" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "DegreeFeePlan" ADD COLUMN IF NOT EXISTS "cardSurcharge" DOUBLE PRECISION;
ALTER TABLE "DegreeFeePlan" ADD COLUMN IF NOT EXISTS "asaasInstallmentId" TEXT;
