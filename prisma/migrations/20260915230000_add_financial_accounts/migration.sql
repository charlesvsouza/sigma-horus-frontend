-- Cadastro de contas financeiras da loja (bancos, com flag de investimento,
-- e Caixa físico) + transferências entre elas com aprovação em dois passos
-- (Tesoureiro cria, Venerável/Admin aprova). Permite vincular cada Account
-- (previsão) e cada Payment (efetivo) a uma conta específica, em vez de tudo
-- cair num pool único de caixa da loja.

CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "bankName" TEXT,
    "isInvestment" BOOLEAN NOT NULL DEFAULT false,
    "agency" TEXT,
    "accountNumber" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialAccount_lodgeId_idx" ON "FinancialAccount"("lodgeId");

ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "FinancialAccount" TO sigma_app;

ALTER TABLE "FinancialAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinancialAccount" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "FinancialAccount";
CREATE POLICY tenant_isolation ON "FinancialAccount"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

CREATE TABLE "AccountTransfer" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountTransfer_lodgeId_idx" ON "AccountTransfer"("lodgeId");
CREATE INDEX "AccountTransfer_fromId_idx" ON "AccountTransfer"("fromId");
CREATE INDEX "AccountTransfer_toId_idx" ON "AccountTransfer"("toId");

ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "AccountTransfer" TO sigma_app;

ALTER TABLE "AccountTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountTransfer" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AccountTransfer";
CREATE POLICY tenant_isolation ON "AccountTransfer"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

-- Conta bancária PREVISTA no lançamento (contas a pagar/receber) — opcional,
-- só pré-preenche o formulário de pagamento.
ALTER TABLE "Account" ADD COLUMN "bankAccountId" TEXT;
CREATE INDEX "Account_bankAccountId_idx" ON "Account"("bankAccountId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Conta bancária/caixa que efetivamente recebeu/pagou o dinheiro.
ALTER TABLE "Payment" ADD COLUMN "bankAccountId" TEXT;
CREATE INDEX "Payment_bankAccountId_idx" ON "Payment"("bankAccountId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
