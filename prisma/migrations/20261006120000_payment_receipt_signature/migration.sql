-- Assinatura digital do recibo de pagamento (Tesoureiro ou Venerável; uma por pagamento).

-- CreateTable
CREATE TABLE "PaymentReceiptSignature" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "signerUserId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerRole" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ip" TEXT,

    CONSTRAINT "PaymentReceiptSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceiptSignature_code_key" ON "PaymentReceiptSignature"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceiptSignature_paymentId_key" ON "PaymentReceiptSignature"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentReceiptSignature_lodgeId_idx" ON "PaymentReceiptSignature"("lodgeId");

-- AddForeignKey
ALTER TABLE "PaymentReceiptSignature" ADD CONSTRAINT "PaymentReceiptSignature_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceiptSignature" ADD CONSTRAINT "PaymentReceiptSignature_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "PaymentReceiptSignature" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "PaymentReceiptSignature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentReceiptSignature" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PaymentReceiptSignature";
CREATE POLICY tenant_isolation ON "PaymentReceiptSignature"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
