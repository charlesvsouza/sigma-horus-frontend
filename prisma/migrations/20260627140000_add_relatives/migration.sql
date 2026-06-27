-- Família e dependentes do membro (mãe, pai, esposa, filhos, outros), com
-- contatos próprios para felicitações de aniversário. RLS por lodgeId.

-- CreateTable
CREATE TABLE "Relative" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "cpf" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Relative_lodgeId_memberId_idx" ON "Relative"("lodgeId", "memberId");
CREATE INDEX "Relative_lodgeId_birthDate_idx" ON "Relative"("lodgeId", "birthDate");

-- AddForeignKey
ALTER TABLE "Relative" ADD CONSTRAINT "Relative_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Relative" ADD CONSTRAINT "Relative_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação (RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON "Relative" TO sigma_app;

-- Row-Level Security por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "Relative" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Relative" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Relative";
CREATE POLICY tenant_isolation ON "Relative"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
