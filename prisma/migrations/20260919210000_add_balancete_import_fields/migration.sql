-- Balancete importado de outro sistema: origem e detalhe por conta do plano.
-- `source` distingue o balancete gerado pelo Sigma Horus ('system') do arquivado a partir de um
-- backup legado ('import'); `detail` guarda as linhas (abertura, débitos, créditos, saldo) por conta.
ALTER TABLE "Balancete" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "Balancete" ADD COLUMN "detail" JSONB;
