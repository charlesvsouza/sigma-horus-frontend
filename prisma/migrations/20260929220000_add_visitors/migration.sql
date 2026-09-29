-- Secretaria: cadastro de irmãos visitantes e visitas às sessões (base do certificado de presença).
-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "degree" TEXT,
    "lodgeName" TEXT,
    "lodgeNumber" TEXT,
    "orient" TEXT,
    "powerName" TEXT,
    "cim" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "consentAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionVisitor" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "degreeAtVisit" TEXT,
    "certificateNumber" TEXT,
    "certificateCode" TEXT,
    "certificateSentAt" TIMESTAMP(3),
    "certificateStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visitor_lodgeId_name_idx" ON "Visitor"("lodgeId", "name");

-- CreateIndex
CREATE INDEX "Visitor_lodgeId_email_idx" ON "Visitor"("lodgeId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SessionVisitor_certificateCode_key" ON "SessionVisitor"("certificateCode");

-- CreateIndex
CREATE INDEX "SessionVisitor_lodgeId_idx" ON "SessionVisitor"("lodgeId");

-- CreateIndex
CREATE INDEX "SessionVisitor_visitorId_idx" ON "SessionVisitor"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionVisitor_sessionId_visitorId_key" ON "SessionVisitor"("sessionId", "visitorId");

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionVisitor" ADD CONSTRAINT "SessionVisitor_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionVisitor" ADD CONSTRAINT "SessionVisitor_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionVisitor" ADD CONSTRAINT "SessionVisitor_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "Visitor" TO sigma_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "SessionVisitor" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "Visitor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Visitor" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Visitor";
CREATE POLICY tenant_isolation ON "Visitor"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

ALTER TABLE "SessionVisitor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionVisitor" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SessionVisitor";
CREATE POLICY tenant_isolation ON "SessionVisitor"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
