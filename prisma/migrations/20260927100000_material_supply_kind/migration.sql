-- Modalidade do fornecimento de materiais: empréstimo (padrão, como antes),
-- cedido pela Potência, venda ou doação da loja. Na venda, guarda o valor
-- unitário e a conta a receber gerada na Tesouraria.

ALTER TABLE "MaterialLoan" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'loan';
ALTER TABLE "MaterialLoan" ADD COLUMN "unitPrice" DOUBLE PRECISION;
ALTER TABLE "MaterialLoan" ADD COLUMN "accountId" TEXT;

ALTER TABLE "MaterialLoan" ADD CONSTRAINT "MaterialLoan_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MaterialLoan_accountId_idx" ON "MaterialLoan"("accountId");
