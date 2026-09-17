-- Entradas manuais da Galeria de Veneráveis (Veneráveis históricos sem cadastro de Member).

CREATE TABLE "VenerableGalleryEntry" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "photoStorageKey" TEXT,
    "periodLabel" TEXT NOT NULL,
    "sortDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VenerableGalleryEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VenerableGalleryEntry_lodgeId_idx" ON "VenerableGalleryEntry"("lodgeId");
ALTER TABLE "VenerableGalleryEntry" ADD CONSTRAINT "VenerableGalleryEntry_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "VenerableGalleryEntry" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "VenerableGalleryEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VenerableGalleryEntry" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "VenerableGalleryEntry";
CREATE POLICY tenant_isolation ON "VenerableGalleryEntry"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
