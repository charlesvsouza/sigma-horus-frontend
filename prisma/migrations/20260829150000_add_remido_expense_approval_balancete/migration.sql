-- Fase 2 (Tesouraria): isenção de mensalidade (Maçom Remido), aprovação de
-- despesa pelo Venerável, e balancete periódico independente do veneralato.

ALTER TABLE "Lodge" ADD COLUMN "expenseApprovalThreshold" DOUBLE PRECISION;
ALTER TABLE "Member" ADD COLUMN "duesExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'approved';

CREATE TABLE "Balancete" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "totalReceivables" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPayables" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPayments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "presentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Balancete_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Balancete_lodgeId_idx" ON "Balancete"("lodgeId");
ALTER TABLE "Balancete" ADD CONSTRAINT "Balancete_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "Balancete" TO sigma_app;

ALTER TABLE "Balancete" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Balancete" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Balancete";
CREATE POLICY tenant_isolation ON "Balancete"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
