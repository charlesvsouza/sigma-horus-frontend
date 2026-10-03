-- Aviso de fim de recorrência (uma vez por cobrança-mãe; zera ao renovar).
ALTER TABLE "Invoice" ADD COLUMN "recurrenceEndNoticeAt" TIMESTAMP(3);
