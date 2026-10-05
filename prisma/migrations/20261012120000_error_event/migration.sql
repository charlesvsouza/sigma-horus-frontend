-- Monitoramento de erros em produção: um registro por "tipo" de erro (impressão digital = origem +
-- rota normalizada + mensagem sem números/ids), com contagem e datas. Ver src/lib/error-monitor.ts.

-- CreateTable
CREATE TABLE "ErrorEvent" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "method" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "digest" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAlertedAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ErrorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErrorEvent_fingerprint_key" ON "ErrorEvent"("fingerprint");

-- CreateIndex
CREATE INDEX "ErrorEvent_lastSeenAt_idx" ON "ErrorEvent"("lastSeenAt");

-- Tabela de PLATAFORMA (sem loja, sem RLS): só o cliente administrativo a usa; o papel da aplicação
-- (sigma_app) não lê nem altera. O papel pode não existir em bancos locais/descartáveis.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigma_app') THEN
    REVOKE ALL ON "ErrorEvent" FROM sigma_app;
  END IF;
END
$$;
