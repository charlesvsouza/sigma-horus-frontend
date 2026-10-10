-- Pedido de reembolso de gasto pago do próprio bolso pelo irmão (nota/recibo em anexo, 1 a 3 arquivos).

-- CreateTable
CREATE TABLE "Reimbursement" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestedVia" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "description" TEXT NOT NULL,
    "vendorName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "chartAccountId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "approvedAmount" DOUBLE PRECISION,
    "implicitApproval" BOOLEAN NOT NULL DEFAULT false,
    "accountId" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reimbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementFile" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "reimbursementId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReimbursementFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reimbursement_lodgeId_status_idx" ON "Reimbursement"("lodgeId", "status");

-- CreateIndex
CREATE INDEX "Reimbursement_lodgeId_memberId_idx" ON "Reimbursement"("lodgeId", "memberId");

-- CreateIndex
CREATE INDEX "ReimbursementFile_lodgeId_reimbursementId_idx" ON "ReimbursementFile"("lodgeId", "reimbursementId");

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementFile" ADD CONSTRAINT "ReimbursementFile_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementFile" ADD CONSTRAINT "ReimbursementFile_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "Reimbursement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "Reimbursement" TO sigma_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ReimbursementFile" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "Reimbursement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reimbursement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Reimbursement";
CREATE POLICY tenant_isolation ON "Reimbursement"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

ALTER TABLE "ReimbursementFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReimbursementFile" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ReimbursementFile";
CREATE POLICY tenant_isolation ON "ReimbursementFile"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
