-- Certificado de presença no modelo da loja: arte de fundo + posições dos campos.
ALTER TABLE "Lodge" ADD COLUMN "certificateArtKey" TEXT;
ALTER TABLE "Lodge" ADD COLUMN "certificateArtType" TEXT;
ALTER TABLE "Lodge" ADD COLUMN "certificateLayout" JSONB;
