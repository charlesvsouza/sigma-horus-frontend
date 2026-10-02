-- Candidatos: tipo de admissão (iniciação de profano ou filiação de maçom de outra loja).
ALTER TABLE "CandidateProcess" ADD COLUMN IF NOT EXISTS "admissionKind" TEXT NOT NULL DEFAULT 'initiation';

-- Taxa de filiação / regularização (Configurações da loja). Ficou fora da 20261003120000, que
-- foi aplicada em produção antes de o campo ser acrescentado a ela.
ALTER TABLE "Lodge" ADD COLUMN IF NOT EXISTS "affiliationFee" DOUBLE PRECISION;
