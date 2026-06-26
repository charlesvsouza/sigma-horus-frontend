-- Billing: trial, intervalo (mensal/anual), método de pagamento e downgrade agendado.
-- Convites: cadastro de teste somente por convite (tabela de plataforma, sem RLS).

-- AlterTable: campos de billing em Subscription (tabela tenant; grants/policies herdam)
ALTER TABLE "Subscription"
  ADD COLUMN "stripeScheduleId" TEXT,
  ADD COLUMN "billingInterval" TEXT NOT NULL DEFAULT 'month',
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "pendingPlan" TEXT,
  ADD COLUMN "pendingPlanEffectiveAt" TIMESTAMP(3);

-- CreateTable: Invitation (plataforma — acessada só pelo client admin/superuser)
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lodgeId" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_code_key" ON "Invitation"("code");
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");

-- Grants ao role de aplicação (sem RLS: tabela de plataforma, não-tenant)
GRANT SELECT, INSERT, UPDATE, DELETE ON "Invitation" TO sigma_app;
