-- Endurecimento de acesso e índices (varredura de debug de 19/09/2026).

-- 1) Tabelas de PLATAFORMA (sem loja): só o cliente administrativo (prismaAdmin, superusuário) as usa.
--    O papel da aplicação (sigma_app, sujeito a RLS) não deve ler nem alterar convites, histórico de
--    backup nem a tabela de migrações — antes tinha SELECT/INSERT/UPDATE/DELETE nelas.
REVOKE ALL ON "Invitation" FROM sigma_app;
REVOKE ALL ON "BackupLog" FROM sigma_app;
REVOKE ALL ON "_prisma_migrations" FROM sigma_app;

-- 2) Índices das consultas por loja/conta/membro (todas as telas filtram por lodgeId).
CREATE INDEX IF NOT EXISTS "Payment_lodgeId_idx" ON "Payment"("lodgeId");
CREATE INDEX IF NOT EXISTS "Payment_accountId_idx" ON "Payment"("accountId");
CREATE INDEX IF NOT EXISTS "Invoice_lodgeId_idx" ON "Invoice"("lodgeId");
CREATE INDEX IF NOT EXISTS "Invoice_accountId_idx" ON "Invoice"("accountId");
CREATE INDEX IF NOT EXISTS "Invoice_memberId_idx" ON "Invoice"("memberId");
CREATE INDEX IF NOT EXISTS "Account_lodgeId_dueDate_idx" ON "Account"("lodgeId", "dueDate");
CREATE INDEX IF NOT EXISTS "Account_memberId_idx" ON "Account"("memberId");
CREATE INDEX IF NOT EXISTS "Member_lodgeId_idx" ON "Member"("lodgeId");
CREATE INDEX IF NOT EXISTS "AuditLog_lodgeId_createdAt_idx" ON "AuditLog"("lodgeId", "createdAt");
CREATE INDEX IF NOT EXISTS "MessageLog_lodgeId_createdAt_idx" ON "MessageLog"("lodgeId", "createdAt");
CREATE INDEX IF NOT EXISTS "Document_lodgeId_idx" ON "Document"("lodgeId");
CREATE INDEX IF NOT EXISTS "Session_lodgeId_date_idx" ON "Session"("lodgeId", "date");
