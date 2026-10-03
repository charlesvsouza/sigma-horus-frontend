-- Art. 002 informativo + bloqueio manual do cadastro (comunicado à Potência) com acordo de regularização.

-- CreateTable
CREATE TABLE "MemberBlock" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedById" TEXT NOT NULL,
    "powerProtocol" TEXT,
    "powerSentAt" TIMESTAMP(3),
    "note" TEXT,
    "overdueDaysAtBlock" INTEGER NOT NULL,
    "overdueAmountAtBlock" DOUBLE PRECISION NOT NULL,
    "debtsTotal" DOUBLE PRECISION NOT NULL,
    "regularizationFee" DOUBLE PRECISION NOT NULL,
    "extraCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "firstDueDate" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "brokenAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "liftedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberBlockItem" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "openAmount" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MemberBlockItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberBlock_lodgeId_memberId_idx" ON "MemberBlock"("lodgeId", "memberId");

-- CreateIndex
CREATE INDEX "MemberBlock_lodgeId_status_idx" ON "MemberBlock"("lodgeId", "status");

-- CreateIndex
CREATE INDEX "MemberBlockItem_lodgeId_idx" ON "MemberBlockItem"("lodgeId");

-- CreateIndex
CREATE INDEX "MemberBlockItem_blockId_idx" ON "MemberBlockItem"("blockId");

-- CreateIndex
CREATE INDEX "MemberBlockItem_accountId_idx" ON "MemberBlockItem"("accountId");

-- AddForeignKey
ALTER TABLE "MemberBlock" ADD CONSTRAINT "MemberBlock_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberBlock" ADD CONSTRAINT "MemberBlock_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberBlockItem" ADD CONSTRAINT "MemberBlockItem_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberBlockItem" ADD CONSTRAINT "MemberBlockItem_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "MemberBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "MemberBlock" TO sigma_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "MemberBlockItem" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "MemberBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberBlock" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "MemberBlock";
CREATE POLICY tenant_isolation ON "MemberBlock"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

ALTER TABLE "MemberBlockItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberBlockItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "MemberBlockItem";
CREATE POLICY tenant_isolation ON "MemberBlockItem"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

-- O Art. 002 deixa de ser uma situação gravada no cadastro (agora é só o enquadramento calculado):
-- quem estava gravado como 'art_002' volta a 'active'. Nenhum bloqueio é criado — quem bloqueia é o
-- Venerável/Administrador, caso a caso.
UPDATE "Member" SET "status" = 'active' WHERE "status" = 'art_002';
