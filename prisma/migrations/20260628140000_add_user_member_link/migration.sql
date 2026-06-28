-- Vínculo Membro → Usuário (acesso do obreiro) + flag de troca de senha provisória.
ALTER TABLE "User" ADD COLUMN "memberId" TEXT;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
