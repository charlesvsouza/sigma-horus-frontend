-- Restrição do cadastro com motivo (Regulamento Geral / Código Disciplinar da GLMERJ).

-- CreateTable
CREATE TABLE "MemberRestriction" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "startedById" TEXT NOT NULL,
    "deliberatedAt" TIMESTAMP(3),
    "expectedEndAt" TIMESTAMP(3),
    "reason" TEXT,
    "destination" TEXT,
    "protocol" TEXT,
    "previousStatus" TEXT,
    "endedAt" TIMESTAMP(3),
    "endedById" TEXT,
    "endNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberRestriction_lodgeId_memberId_idx" ON "MemberRestriction"("lodgeId", "memberId");

-- CreateIndex
CREATE INDEX "MemberRestriction_lodgeId_status_idx" ON "MemberRestriction"("lodgeId", "status");

-- AddForeignKey
ALTER TABLE "MemberRestriction" ADD CONSTRAINT "MemberRestriction_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRestriction" ADD CONSTRAINT "MemberRestriction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "MemberRestriction" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "MemberRestriction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberRestriction" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "MemberRestriction";
CREATE POLICY tenant_isolation ON "MemberRestriction"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
