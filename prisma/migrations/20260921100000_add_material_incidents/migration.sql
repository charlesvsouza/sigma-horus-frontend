-- Ocorrências de inventário (desgaste, dano irreversível, perda) registradas
-- pelo Arquiteto e decididas por quem gere os materiais (baixa / reposição /
-- dispensa). Sem valores monetários. Ver model MaterialIncident no schema.

CREATE TABLE "MaterialIncident" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "requestReplacement" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "reportedById" TEXT,
    "reportedByName" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedById" TEXT,
    "resolvedByName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialIncident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaterialIncident_lodgeId_materialId_idx" ON "MaterialIncident"("lodgeId", "materialId");
CREATE INDEX "MaterialIncident_lodgeId_status_idx" ON "MaterialIncident"("lodgeId", "status");

ALTER TABLE "MaterialIncident" ADD CONSTRAINT "MaterialIncident_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialIncident" ADD CONSTRAINT "MaterialIncident_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "MaterialIncident" TO sigma_app;
ALTER TABLE "MaterialIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialIncident" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "MaterialIncident";
CREATE POLICY tenant_isolation ON "MaterialIncident"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
