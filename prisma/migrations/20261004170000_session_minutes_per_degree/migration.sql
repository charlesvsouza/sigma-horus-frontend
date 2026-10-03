-- Balaustre da sessão por grau (até 3: Aprendiz, Companheiro, Mestre).

-- CreateTable
CREATE TABLE "SessionMinutes" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "degree" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionMinutes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionMinutes_sessionId_degree_key" ON "SessionMinutes"("sessionId", "degree");

-- CreateIndex
CREATE INDEX "SessionMinutes_lodgeId_idx" ON "SessionMinutes"("lodgeId");

-- AddForeignKey
ALTER TABLE "SessionMinutes" ADD CONSTRAINT "SessionMinutes_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMinutes" ADD CONSTRAINT "SessionMinutes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "SessionMinutes" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "SessionMinutes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionMinutes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SessionMinutes";
CREATE POLICY tenant_isolation ON "SessionMinutes"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

-- O balaustre que já existia (um só por sessão) passa a ser o do MENOR grau da sessão (1 se não há graus).
-- As colunas antigas Session.minutes* não são apagadas (ficam como legado).
INSERT INTO "SessionMinutes" ("id", "lodgeId", "sessionId", "degree", "storageKey", "fileName", "mimeType", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."lodgeId", s."id",
       COALESCE((SELECT MIN(d) FROM unnest(s."degrees") AS d WHERE d BETWEEN 1 AND 3), 1),
       s."minutesStorageKey", COALESCE(s."minutesFileName", 'balaustre'), COALESCE(s."minutesMimeType", 'application/pdf'),
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Session" s
WHERE s."minutesStorageKey" IS NOT NULL;
