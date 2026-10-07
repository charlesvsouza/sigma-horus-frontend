-- Conferência do livro com o banco (trava por data) + pedido de retificação com ciência do Venerável.

-- CreateTable
CREATE TABLE "LedgerCheckpoint" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "throughDate" TIMESTAMP(3) NOT NULL,
    "balancesJson" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedByName" TEXT NOT NULL,
    "note" TEXT,
    "undoneAt" TIMESTAMP(3),
    "undoneById" TEXT,
    "undoneByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerRectification" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "selfApproved" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "LedgerRectification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerCheckpoint_lodgeId_throughDate_idx" ON "LedgerCheckpoint"("lodgeId", "throughDate");

-- CreateIndex
CREATE INDEX "LedgerRectification_lodgeId_status_idx" ON "LedgerRectification"("lodgeId", "status");

-- AddForeignKey
ALTER TABLE "LedgerCheckpoint" ADD CONSTRAINT "LedgerCheckpoint_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerRectification" ADD CONSTRAINT "LedgerRectification_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "LedgerCheckpoint" TO sigma_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "LedgerRectification" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "LedgerCheckpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerCheckpoint" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LedgerCheckpoint";
CREATE POLICY tenant_isolation ON "LedgerCheckpoint"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

ALTER TABLE "LedgerRectification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerRectification" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LedgerRectification";
CREATE POLICY tenant_isolation ON "LedgerRectification"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
