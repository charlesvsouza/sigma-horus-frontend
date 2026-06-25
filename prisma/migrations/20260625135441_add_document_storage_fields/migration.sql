-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "category" TEXT DEFAULT 'general',
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "status" TEXT DEFAULT 'draft',
ADD COLUMN     "storageKey" TEXT;
