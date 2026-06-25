-- Asaas BYO-key por loja: credenciais criptografadas no Lodge + customer id no Member
-- AlterTable
ALTER TABLE "Lodge" ADD COLUMN     "asaasApiKeyEnc" TEXT,
ADD COLUMN     "asaasEnv" TEXT DEFAULT 'sandbox',
ADD COLUMN     "asaasWebhookToken" TEXT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "asaasCustomerId" TEXT;
