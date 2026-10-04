-- QR do Tronco da sessão também no Modo Loja (Pix estático da chave da loja com identificador da sessão).
ALTER TABLE "TroncoSessionQr" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'asaas';
ALTER TABLE "TroncoSessionQr" ADD COLUMN "identifier" TEXT;
