-- Inventário patrimonial de uso geral da loja (Material) e fornecimento/
-- empréstimo a membros (MaterialLoan) — cadastro operacional por quantidade,
-- distinto do Asset (financeiro/depreciação, ver dashboard/patrimonio).

CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "riteId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "requiredDegree" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Material_lodgeId_name_key" ON "Material"("lodgeId", "name");
CREATE INDEX "Material_lodgeId_category_idx" ON "Material"("lodgeId", "category");

ALTER TABLE "Material" ADD CONSTRAINT "Material_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_riteId_fkey" FOREIGN KEY ("riteId") REFERENCES "Rite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "Material" TO sigma_app;
ALTER TABLE "Material" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Material" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Material";
CREATE POLICY tenant_isolation ON "Material"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

CREATE TABLE "MaterialLoan" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialLoan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaterialLoan_lodgeId_materialId_idx" ON "MaterialLoan"("lodgeId", "materialId");
CREATE INDEX "MaterialLoan_lodgeId_memberId_idx" ON "MaterialLoan"("lodgeId", "memberId");
CREATE INDEX "MaterialLoan_lodgeId_status_idx" ON "MaterialLoan"("lodgeId", "status");

ALTER TABLE "MaterialLoan" ADD CONSTRAINT "MaterialLoan_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialLoan" ADD CONSTRAINT "MaterialLoan_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialLoan" ADD CONSTRAINT "MaterialLoan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "MaterialLoan" TO sigma_app;
ALTER TABLE "MaterialLoan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialLoan" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "MaterialLoan";
CREATE POLICY tenant_isolation ON "MaterialLoan"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
