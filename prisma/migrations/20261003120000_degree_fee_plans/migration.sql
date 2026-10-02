-- Tesouraria: taxas de grau (iniciação/elevação/exaltação/filiação-regularização) — valores na loja e planos de pagamento em cotas.
-- AlterTable
ALTER TABLE "Lodge" ADD COLUMN     "elevationFee" DOUBLE PRECISION,
ADD COLUMN     "exaltationFee" DOUBLE PRECISION,
ADD COLUMN     "initiationFee" DOUBLE PRECISION,
ADD COLUMN     "affiliationFee" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "degreeFeePlanId" TEXT;

-- CreateTable
CREATE TABLE "DegreeFeePlan" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "installments" INTEGER NOT NULL,
    "firstDueDate" TIMESTAMP(3) NOT NULL,
    "fourthInstructionDate" TIMESTAMP(3),
    "expectedEventDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "canceledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "refundAccountId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DegreeFeePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DegreeFeePlan_lodgeId_idx" ON "DegreeFeePlan"("lodgeId");

-- CreateIndex
CREATE INDEX "DegreeFeePlan_memberId_idx" ON "DegreeFeePlan"("memberId");

-- CreateIndex
CREATE INDEX "Account_degreeFeePlanId_idx" ON "Account"("degreeFeePlanId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_degreeFeePlanId_fkey" FOREIGN KEY ("degreeFeePlanId") REFERENCES "DegreeFeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DegreeFeePlan" ADD CONSTRAINT "DegreeFeePlan_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DegreeFeePlan" ADD CONSTRAINT "DegreeFeePlan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "DegreeFeePlan" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "DegreeFeePlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DegreeFeePlan" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DegreeFeePlan";
CREATE POLICY tenant_isolation ON "DegreeFeePlan"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
