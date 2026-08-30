-- Fase 3 (Tesouraria): multa/juros de mora informativos, configuráveis por loja.
ALTER TABLE "Lodge" ADD COLUMN "lateFeePercent" DOUBLE PRECISION;
ALTER TABLE "Lodge" ADD COLUMN "lateInterestPercentMonth" DOUBLE PRECISION;
