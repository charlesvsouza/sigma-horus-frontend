-- Nota: o `prisma migrate dev` detectou aqui uma divergência pré-existente,
-- não relacionada a esta migration (DROP INDEX em Account/Office e um ALTER
-- COLUMN em Lodge.terminatedAt) — removida deliberadamente deste arquivo para
-- não aplicar mudanças não revisadas em produção. Ver AGENTS.md.

-- CreateTable
CREATE TABLE "BackupLog" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT,
    "status" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "totalRows" INTEGER,
    "modelCounts" TEXT,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupLog_createdAt_idx" ON "BackupLog"("createdAt");

-- Grants ao role de aplicação (sem RLS: tabela de plataforma, não-tenant;
-- acessada só via prismaAdmin pelo cron de backup e pelo painel /plataforma/backups)
GRANT SELECT, INSERT, UPDATE, DELETE ON "BackupLog" TO sigma_app;
