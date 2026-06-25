-- Dados comerciais e bancários da loja (PJ sem fins lucrativos).
ALTER TABLE "Lodge"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "tradeName" TEXT,
  ADD COLUMN "cnpj" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "addressLine" TEXT,
  ADD COLUMN "addressNumber" TEXT,
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "zipCode" TEXT,
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "bankAgency" TEXT,
  ADD COLUMN "bankAccount" TEXT,
  ADD COLUMN "pixKey" TEXT;
