-- Emissão automática no Asaas (opt-in por loja, só vale no Modo Asaas): a rotina diária
-- emite as cobranças ainda não emitidas que vencem de hoje até 3 dias. Desligada por padrão.

ALTER TABLE "Lodge" ADD COLUMN "asaasAutoEmit" BOOLEAN NOT NULL DEFAULT false;
