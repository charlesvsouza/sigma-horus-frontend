-- Ordem do dia (antes) e balaustre/ata (depois) da sessão, visíveis ao
-- obreiro na agenda da Secretaria — mais o registro de quando o chamado
-- (convocação) foi enviado por e-mail.
ALTER TABLE "Session" ADD COLUMN "agenda" TEXT;
ALTER TABLE "Session" ADD COLUMN "minutes" TEXT;
ALTER TABLE "Session" ADD COLUMN "convocationSentAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "convocationSentById" TEXT;

-- Pedido leve do obreiro à Hospitalaria (proposta/solicitação de auxílio) —
-- só notifica o Hospitaleiro, não vira Campaign sozinho.
CREATE TABLE "HospitalityRequest" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalityRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HospitalityRequest_lodgeId_idx" ON "HospitalityRequest"("lodgeId");

ALTER TABLE "HospitalityRequest" ADD CONSTRAINT "HospitalityRequest_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalityRequest" ADD CONSTRAINT "HospitalityRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants ao role de aplicação (RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON "HospitalityRequest" TO sigma_app;

-- Row-Level Security por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "HospitalityRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HospitalityRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "HospitalityRequest";
CREATE POLICY tenant_isolation ON "HospitalityRequest"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
