-- Fase 4 (Tesouraria): orçamento anual por categoria do plano de contas.
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "chartAccountId" TEXT NOT NULL,
    "plannedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Budget_lodgeId_year_chartAccountId_key" ON "Budget"("lodgeId", "year", "chartAccountId");
CREATE INDEX "Budget_lodgeId_idx" ON "Budget"("lodgeId");
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_chartAccountId_fkey" FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "Budget" TO sigma_app;

ALTER TABLE "Budget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Budget" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Budget";
CREATE POLICY tenant_isolation ON "Budget"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
