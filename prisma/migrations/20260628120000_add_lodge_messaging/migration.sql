-- Mensageria BYO por loja (WhatsApp/SMS): credenciais próprias, custo direto da loja.
ALTER TABLE "Lodge" ADD COLUMN "whatsappPhoneId" TEXT;
ALTER TABLE "Lodge" ADD COLUMN "whatsappTokenEnc" TEXT;
ALTER TABLE "Lodge" ADD COLUMN "whatsappTemplate" TEXT;
ALTER TABLE "Lodge" ADD COLUMN "whatsappTemplateLang" TEXT DEFAULT 'pt_BR';
ALTER TABLE "Lodge" ADD COLUMN "smsAccountSid" TEXT;
ALTER TABLE "Lodge" ADD COLUMN "smsAuthTokenEnc" TEXT;
ALTER TABLE "Lodge" ADD COLUMN "smsFrom" TEXT;
