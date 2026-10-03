-- Assinatura digital do Termo de acordo de regularização.

-- CreateTable
CREATE TABLE "MemberBlockSignature" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "signerUserId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerRole" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ip" TEXT,

    CONSTRAINT "MemberBlockSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberBlockSignature_code_key" ON "MemberBlockSignature"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MemberBlockSignature_blockId_party_key" ON "MemberBlockSignature"("blockId", "party");

-- CreateIndex
CREATE INDEX "MemberBlockSignature_lodgeId_idx" ON "MemberBlockSignature"("lodgeId");

-- AddForeignKey
ALTER TABLE "MemberBlockSignature" ADD CONSTRAINT "MemberBlockSignature_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberBlockSignature" ADD CONSTRAINT "MemberBlockSignature_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "MemberBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "MemberBlockSignature" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "MemberBlockSignature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberBlockSignature" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "MemberBlockSignature";
CREATE POLICY tenant_isolation ON "MemberBlockSignature"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
