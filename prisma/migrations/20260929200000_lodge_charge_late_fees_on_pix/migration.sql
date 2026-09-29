-- Modo Loja: cobrar multa/juros de mora no Pix de cobrança vencida (desligado por padrão).
ALTER TABLE "Lodge" ADD COLUMN "chargeLateFeesOnPix" BOOLEAN NOT NULL DEFAULT false;
