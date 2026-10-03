-- Documentos: grau mínimo para ver o documento institucional (null = todos os obreiros).
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "minDegree" TEXT;
