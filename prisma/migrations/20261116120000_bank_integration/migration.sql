-- Integração da loja com a API de um banco (Itaú): só acréscimos, nada existente muda.
-- Segredos (client_id, client_secret, certificado, chave privada) ficam cifrados pela aplicação.
CREATE TABLE "BankIntegration" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "env" TEXT NOT NULL DEFAULT 'production',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "clientIdEnc" TEXT,
    "clientSecretEnc" TEXT,
    "certificateEnc" TEXT,
    "privateKeyEnc" TEXT,
    "certNotAfter" TIMESTAMP(3),
    "certAlertedAt" TIMESTAMP(3),
    "pixKey" TEXT,
    "settlementAccountId" TEXT,
    "tokenPath" TEXT,
    "lastPixPollAt" TIMESTAMP(3),
    "lastCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankIntegration_lodgeId_provider_key" ON "BankIntegration"("lodgeId", "provider");
CREATE INDEX "BankIntegration_lodgeId_idx" ON "BankIntegration"("lodgeId");

ALTER TABLE "BankIntegration" ADD CONSTRAINT "BankIntegration_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "BankIntegration" TO sigma_app;

ALTER TABLE "BankIntegration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankIntegration" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BankIntegration";
CREATE POLICY tenant_isolation ON "BankIntegration"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

-- Cobrança emitida por um banco: quem emitiu, o código no banco (txid) e o Pix copia e cola.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "chargeProvider" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "chargeExternalId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pixCopiaECola" TEXT;
CREATE INDEX IF NOT EXISTS "Invoice_lodgeId_chargeExternalId_idx" ON "Invoice"("lodgeId", "chargeExternalId");
