-- Data de fundação da loja + toggle de mensagem comemorativa automática.
ALTER TABLE "Lodge" ADD COLUMN "foundationDate" TIMESTAMP(3);
ALTER TABLE "Lodge" ADD COLUMN "notifyFoundationAnniversaryEnabled" BOOLEAN NOT NULL DEFAULT true;
