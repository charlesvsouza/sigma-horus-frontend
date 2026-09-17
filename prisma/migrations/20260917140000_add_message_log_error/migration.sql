-- Guarda o motivo de queued/failed (ex.: "WhatsApp não conectado nesta
-- loja.", "Resend 429") — dispatch() já calculava esse texto, mas nunca era
-- persistido, obrigando quem investigasse uma falha a ler o código-fonte.
ALTER TABLE "MessageLog" ADD COLUMN "error" TEXT;
