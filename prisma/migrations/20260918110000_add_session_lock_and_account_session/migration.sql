-- Trava de sessão (Session.locked/lockedAt/lockedById) — trancada
-- automaticamente ao salvar o balaustre; só Administrador/Venerável destranca.
-- Account.sessionId vincula um lançamento (ex.: doação ao Tronco de
-- Solidariedade) à sessão do dia em que ocorreu.

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedById" TEXT;

-- CreateIndex
CREATE INDEX "Account_sessionId_idx" ON "Account"("sessionId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
