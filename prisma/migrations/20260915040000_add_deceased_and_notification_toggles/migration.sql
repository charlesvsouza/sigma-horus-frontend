-- Falecido (Member/Relative) — exclui de felicitações de aniversário/jubileu
-- automáticas. Toggles de mensagens automáticas por categoria (Lodge).

ALTER TABLE "Member" ADD COLUMN "deceased" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Relative" ADD COLUMN "deceased" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Lodge" ADD COLUMN "notifyBirthdaysEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Lodge" ADD COLUMN "notifyMilestonesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Lodge" ADD COLUMN "notifyBillingRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;
