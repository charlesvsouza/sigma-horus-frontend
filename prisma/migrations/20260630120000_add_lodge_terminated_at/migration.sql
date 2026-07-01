-- Adiciona campo terminated_at à tabela Lodge para controle de encerramento
-- e purge automático de dados após 90 dias.
ALTER TABLE "Lodge" ADD COLUMN "terminatedAt" TIMESTAMPTZ;
