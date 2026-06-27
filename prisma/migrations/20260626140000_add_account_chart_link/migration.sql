-- Vínculo da conta ao plano de contas (livro caixa / balancete / fechamento).
ALTER TABLE "Account" ADD COLUMN "chartAccountId" TEXT;

ALTER TABLE "Account"
  ADD CONSTRAINT "Account_chartAccountId_fkey"
  FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Account_chartAccountId_idx" ON "Account"("chartAccountId");
