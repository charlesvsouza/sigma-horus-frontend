-- Dia contábil único: Payment.paidAt e AccountTransfer.date misturavam a data digitada (00:00 UTC, "só dia") e o
-- instante real (baixas antigas do Asaas, aportes do Tronco). Os instantes viram o DIA DE BRASÍLIA em que
-- aconteceram, às 00:00 UTC — exatamente o dia que as telas já mostravam (lib/ledger-day.ts), então nenhum saldo
-- nem extrato muda; só deixam de cair no dia errado os relatórios que filtram por instante (DRE, fechamento…).
UPDATE "Payment"
   SET "paidAt" = (("paidAt" - interval '3 hours')::date)::timestamp
 WHERE "paidAt" <> date_trunc('day', "paidAt");

UPDATE "AccountTransfer"
   SET "date" = (("date" - interval '3 hours')::date)::timestamp
 WHERE "date" <> date_trunc('day', "date");
