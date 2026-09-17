-- Vincula uma entrada manual da Galeria de Veneráveis a um Member já cadastrado,
-- pra herdar a foto do cadastro em vez de exigir upload próprio.
ALTER TABLE "VenerableGalleryEntry" ADD COLUMN "memberId" TEXT;
CREATE INDEX "VenerableGalleryEntry_memberId_idx" ON "VenerableGalleryEntry"("memberId");
ALTER TABLE "VenerableGalleryEntry" ADD CONSTRAINT "VenerableGalleryEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
