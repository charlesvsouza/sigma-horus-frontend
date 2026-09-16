-- Documento institucional: memberId passa a ser opcional. NULL = documento
-- da loja (Regimento Interno, Regulamento Geral, Constituição da Potência
-- etc.), visível/baixável por todos os membros da loja, não um único membro.

-- Saneia linhas antigas gravadas com memberId='' em vez de NULL (bug em
-- api/documents/route.ts e api/documents/upload/route.ts, corrigido junto).
UPDATE "Document" SET "memberId" = NULL WHERE "memberId" = '';

ALTER TABLE "Document" DROP CONSTRAINT "Document_memberId_fkey";
ALTER TABLE "Document" ALTER COLUMN "memberId" DROP NOT NULL;
ALTER TABLE "Document" ADD CONSTRAINT "Document_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
