-- Limite de tentativas por IP (login, redefinição de senha, cadastro público). Janela fixa: a
-- linha é reiniciada quando "resetAt" vence. Ver src/lib/rate-limit.ts.

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- Tabela de PLATAFORMA (sem loja): só o cliente administrativo (superusuário) a usa. O papel da
-- aplicação (sigma_app, sujeito a RLS) não deve nem ler nem alterar os contadores. O papel pode
-- não existir em bancos locais/descartáveis.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigma_app') THEN
    REVOKE ALL ON "RateLimit" FROM sigma_app;
  END IF;
END
$$;
