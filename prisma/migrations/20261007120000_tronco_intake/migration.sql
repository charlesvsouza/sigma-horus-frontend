-- Entrada do Tronco de Solidariedade da sessão (declarada / confirmada / recusada), sem identificar o doador.

-- CreateTable
CREATE TABLE "TroncoIntake" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "sessionId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'mixed',
    "channel" TEXT NOT NULL DEFAULT 'cash',
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "code" TEXT NOT NULL,
    "externalRef" TEXT,
    "note" TEXT,
    "declaredById" TEXT,
    "declaredByName" TEXT,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "paymentId" TEXT,

    CONSTRAINT "TroncoIntake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TroncoIntake_code_key" ON "TroncoIntake"("code");
CREATE UNIQUE INDEX "TroncoIntake_externalRef_key" ON "TroncoIntake"("externalRef");
CREATE UNIQUE INDEX "TroncoIntake_paymentId_key" ON "TroncoIntake"("paymentId");
CREATE INDEX "TroncoIntake_lodgeId_sessionId_idx" ON "TroncoIntake"("lodgeId", "sessionId");
CREATE INDEX "TroncoIntake_lodgeId_status_idx" ON "TroncoIntake"("lodgeId", "status");

-- AddForeignKey
ALTER TABLE "TroncoIntake" ADD CONSTRAINT "TroncoIntake_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TroncoIntake" ADD CONSTRAINT "TroncoIntake_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TroncoIntake" ADD CONSTRAINT "TroncoIntake_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "TroncoIntake" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "TroncoIntake" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TroncoIntake" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TroncoIntake";
CREATE POLICY tenant_isolation ON "TroncoIntake"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
