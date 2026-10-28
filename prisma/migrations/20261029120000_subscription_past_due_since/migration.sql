-- Início do atraso do pagamento da assinatura: 30 dias de tolerância antes do bloqueio.
ALTER TABLE "Subscription" ADD COLUMN "pastDueSince" TIMESTAMP(3);
