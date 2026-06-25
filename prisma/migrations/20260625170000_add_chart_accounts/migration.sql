-- Plano de contas da loja (categorias de receita/despesa) com RLS por lodgeId.

-- CreateTable
CREATE TABLE "ChartAccount" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChartAccount_lodgeId_code_key" ON "ChartAccount"("lodgeId", "code");

-- AddForeignKey
ALTER TABLE "ChartAccount" ADD CONSTRAINT "ChartAccount_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação (RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON "ChartAccount" TO sigma_app;

-- Row-Level Security por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "ChartAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChartAccount" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ChartAccount";
CREATE POLICY tenant_isolation ON "ChartAccount"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
