-- Término da sessão (gate de presença) + balaustre como arquivo importado.
ALTER TABLE "Session" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "minutesStorageKey" TEXT;
ALTER TABLE "Session" ADD COLUMN "minutesFileName" TEXT;
ALTER TABLE "Session" ADD COLUMN "minutesMimeType" TEXT;
