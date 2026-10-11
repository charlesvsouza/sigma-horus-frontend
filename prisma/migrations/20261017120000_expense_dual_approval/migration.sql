-- Dupla aprovação opcional de despesa acima do limite (Venerável + Tesoureiro; Administrador pode aprovar sozinho).

-- AlterTable
ALTER TABLE "Lodge" ADD COLUMN "expenseDualApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExpenseApproval" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "valve" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseApproval_accountId_userId_key" ON "ExpenseApproval"("accountId", "userId");

-- CreateIndex
CREATE INDEX "ExpenseApproval_lodgeId_accountId_idx" ON "ExpenseApproval"("lodgeId", "accountId");

-- AddForeignKey
ALTER TABLE "ExpenseApproval" ADD CONSTRAINT "ExpenseApproval_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseApproval" ADD CONSTRAINT "ExpenseApproval_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "ExpenseApproval" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "ExpenseApproval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseApproval" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ExpenseApproval";
CREATE POLICY tenant_isolation ON "ExpenseApproval"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
