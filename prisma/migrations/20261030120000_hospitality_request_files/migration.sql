-- Documentos (PDF/foto) que o irmão anexa ao pedido feito à Hospitalaria.
CREATE TABLE "HospitalityRequestFile" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalityRequestFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HospitalityRequestFile_lodgeId_requestId_idx" ON "HospitalityRequestFile"("lodgeId", "requestId");

ALTER TABLE "HospitalityRequestFile" ADD CONSTRAINT "HospitalityRequestFile_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalityRequestFile" ADD CONSTRAINT "HospitalityRequestFile_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HospitalityRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "HospitalityRequestFile" TO sigma_app;

ALTER TABLE "HospitalityRequestFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HospitalityRequestFile" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "HospitalityRequestFile";
CREATE POLICY tenant_isolation ON "HospitalityRequestFile"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
