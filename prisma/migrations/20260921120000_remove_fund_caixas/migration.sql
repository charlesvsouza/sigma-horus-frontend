-- Tronco de Beneficência e Doações e Contribuições deixam de ter "caixa" próprio:
-- passam a ser só categorias do plano de contas (centros de custo), e o dinheiro
-- entra/sai pelos bancos e caixa reais da loja. Ver lib/funds.ts.
--
-- 1) Remove os caixas de fundo que nunca foram usados (sem saldo inicial, sem
--    pagamento, sem lançamento previsto, sem transferência e que não são a conta
--    de repasse do Asaas).
DELETE FROM "FinancialAccount" fa
WHERE fa."purpose" IN ('tronco', 'donations')
  AND fa."openingBalance" = 0
  AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."bankAccountId" = fa."id")
  AND NOT EXISTS (SELECT 1 FROM "Account" a WHERE a."bankAccountId" = fa."id")
  AND NOT EXISTS (SELECT 1 FROM "AccountTransfer" t WHERE t."fromId" = fa."id" OR t."toId" = fa."id")
  AND NOT EXISTS (SELECT 1 FROM "Lodge" l WHERE l."asaasSettlementAccountId" = fa."id");

-- 2) Os que tiverem histórico viram contas comuns (o histórico e o saldo ficam
--    intactos; a loja pode desativá-las quando zerarem).
UPDATE "FinancialAccount" SET "purpose" = 'general' WHERE "purpose" <> 'general';
