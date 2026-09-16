-- Brasão da loja (identidade visual): exibido em relatórios, recibos e demais
-- documentos gerados/enviados, e no cabeçalho HTML dos e-mails automáticos.
ALTER TABLE "Lodge" ADD COLUMN "crestUrl" TEXT;
ALTER TABLE "Lodge" ADD COLUMN "crestStorageKey" TEXT;
