-- Add riteId to Office model with relation to Rite
ALTER TABLE "Office" ADD COLUMN "riteId" TEXT;

ALTER TABLE "Office" ADD CONSTRAINT "Office_riteId_fkey" FOREIGN KEY ("riteId") REFERENCES "Rite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Office_lodgeId_riteId_name_key" ON "Office"("lodgeId", "riteId", "name");
