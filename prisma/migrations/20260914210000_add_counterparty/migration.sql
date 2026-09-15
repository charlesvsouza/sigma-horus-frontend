-- Cadastro de clientes/fornecedores (Counterparty) — contrapartes de Account
-- que não são membros da loja. Um modelo só pros dois papéis (kind), no
-- mesmo espírito de ChartAccount.type separar REVENUE/EXPENSE numa tabela só.
-- Pensado para ser reaproveitado por qualquer loja, não só a que motivou
-- (migração do backup financeiro da Loja Antônio Monteiro Martins).

CREATE TABLE "Counterparty" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'supplier',
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "document" TEXT,
    "isCompany" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "phone" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counterparty_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Counterparty_lodgeId_document_key" ON "Counterparty"("lodgeId", "document");
CREATE INDEX "Counterparty_lodgeId_name_idx" ON "Counterparty"("lodgeId", "name");

ALTER TABLE "Counterparty" ADD CONSTRAINT "Counterparty_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação (RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON "Counterparty" TO sigma_app;

-- Row-Level Security por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "Counterparty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Counterparty" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Counterparty";
CREATE POLICY tenant_isolation ON "Counterparty"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

ALTER TABLE "Account" ADD COLUMN "counterpartyId" TEXT;
CREATE INDEX "Account_counterpartyId_idx" ON "Account"("counterpartyId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
