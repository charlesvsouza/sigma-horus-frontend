-- RBAC persistido por loja: matriz papel × recurso × ação, com RLS por lodgeId.
-- Lojas sem linhas usam os padrões de src/lib/rbac.ts (DEFAULT_POLICY).

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_lodgeId_role_resource_action_key" ON "RolePermission"("lodgeId", "role", "resource", "action");
CREATE INDEX "RolePermission_lodgeId_idx" ON "RolePermission"("lodgeId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação (RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON "RolePermission" TO sigma_app;

-- Row-Level Security por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RolePermission";
CREATE POLICY tenant_isolation ON "RolePermission"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
