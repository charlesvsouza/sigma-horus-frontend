-- Hospitalaria: Tronco de Solidariedade (flag) + campanhas de benemerência.

-- Flag de conta do Tronco de Solidariedade no plano de contas.
ALTER TABLE "ChartAccount" ADD COLUMN "isSolidarity" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable Campaign
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "beneficiaryType" TEXT NOT NULL,
    "beneficiaryName" TEXT,
    "goalAmount" DOUBLE PRECISION,
    "fundingSource" TEXT NOT NULL DEFAULT 'donations',
    "fundAllocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Campaign_lodgeId_idx" ON "Campaign"("lodgeId");
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable CampaignDonation
CREATE TABLE "CampaignDonation" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "donorName" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "amount" DOUBLE PRECISION NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignDonation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CampaignDonation_lodgeId_campaignId_idx" ON "CampaignDonation"("lodgeId", "campaignId");
ALTER TABLE "CampaignDonation" ADD CONSTRAINT "CampaignDonation_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignDonation" ADD CONSTRAINT "CampaignDonation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "Campaign" TO sigma_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "CampaignDonation" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaign" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Campaign";
CREATE POLICY tenant_isolation ON "Campaign"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

ALTER TABLE "CampaignDonation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignDonation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CampaignDonation";
CREATE POLICY tenant_isolation ON "CampaignDonation"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
