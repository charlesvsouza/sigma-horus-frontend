-- Documentos (PDF/foto) anexados a uma campanha de benemerência, para formalizar o pedido.
CREATE TABLE "CampaignFile" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignFile_lodgeId_campaignId_idx" ON "CampaignFile"("lodgeId", "campaignId");

ALTER TABLE "CampaignFile" ADD CONSTRAINT "CampaignFile_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignFile" ADD CONSTRAINT "CampaignFile_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "CampaignFile" TO sigma_app;

ALTER TABLE "CampaignFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignFile" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CampaignFile";
CREATE POLICY tenant_isolation ON "CampaignFile"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
