-- Graus trabalhados na sessão (checkbox 1/2/3) + texto exato da última convocação enviada.
ALTER TABLE "Session" ADD COLUMN "degrees" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Session" ADD COLUMN "convocationText" TEXT;

-- Referência do envio (ex.: "session-convocation:<id>") para agrupar os envios de uma convocação.
ALTER TABLE "MessageLog" ADD COLUMN "ref" TEXT;
CREATE INDEX "MessageLog_lodgeId_ref_idx" ON "MessageLog"("lodgeId", "ref");
