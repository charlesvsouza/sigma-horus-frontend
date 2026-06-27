-- Potência de origem do membro (bloco "Origem"), distinta da potência atual.
ALTER TABLE "Member" ADD COLUMN "originPowerId" TEXT;

ALTER TABLE "Member" ADD CONSTRAINT "Member_originPowerId_fkey"
  FOREIGN KEY ("originPowerId") REFERENCES "Power"("id") ON DELETE SET NULL ON UPDATE CASCADE;
