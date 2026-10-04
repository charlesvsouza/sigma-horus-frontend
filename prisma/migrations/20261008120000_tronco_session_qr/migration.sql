-- QR Pix estático do Asaas por sessão (Tronco de Solidariedade) e tarifa na entrada.

ALTER TABLE "TroncoIntake" ADD COLUMN "fee" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "TroncoSessionQr" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "asaasQrId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TroncoSessionQr_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TroncoSessionQr_asaasQrId_key" ON "TroncoSessionQr"("asaasQrId");
CREATE UNIQUE INDEX "TroncoSessionQr_sessionId_source_key" ON "TroncoSessionQr"("sessionId", "source");
CREATE INDEX "TroncoSessionQr_lodgeId_idx" ON "TroncoSessionQr"("lodgeId");

-- AddForeignKey
ALTER TABLE "TroncoSessionQr" ADD CONSTRAINT "TroncoSessionQr_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TroncoSessionQr" ADD CONSTRAINT "TroncoSessionQr_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "TroncoSessionQr" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "TroncoSessionQr" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TroncoSessionQr" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TroncoSessionQr";
CREATE POLICY tenant_isolation ON "TroncoSessionQr"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
