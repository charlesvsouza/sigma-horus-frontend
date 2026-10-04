-- Benefício de mensalidade "só a parte da Potência": o irmão é isento da parte da loja e a
-- mensalidade nasce no valor que a loja repassa à Potência (Lodge.powerDuesAmount).
ALTER TABLE "Lodge" ADD COLUMN "powerDuesAmount" DOUBLE PRECISION;
ALTER TABLE "Member" ADD COLUMN "duesPotencyOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "duesPotencyReason" TEXT;
