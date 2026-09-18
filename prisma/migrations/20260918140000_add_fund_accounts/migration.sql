-- Fundos com caixa próprio: Tronco de Beneficência e Doações e Contribuições.
-- FinancialAccount.purpose diz de qual fundo é o caixa; ChartAccount.fundPurpose diz
-- a que fundo pertence a categoria (define o caixa padrão de doações/custeio).
ALTER TABLE "FinancialAccount" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "ChartAccount" ADD COLUMN "fundPurpose" TEXT;

-- Categorias existentes: Tronco (solidariedade, receita e despesa) e Doações e Contribuições (1.1.04).
UPDATE "ChartAccount" SET "fundPurpose" = 'tronco' WHERE "isSolidarity" = true;
UPDATE "ChartAccount" SET "fundPurpose" = 'donations' WHERE "code" = '1.1.04';

-- Um caixa para cada fundo em cada loja ativa que ainda não tenha (saldo inicial 0, ajustável em Cadastros).
INSERT INTO "FinancialAccount" ("id", "lodgeId", "name", "kind", "purpose", "openingBalance", "updatedAt")
SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text || l."id"), 1, 24), l."id",
       'Caixa do Tronco de Beneficência', 'cash', 'tronco', 0, CURRENT_TIMESTAMP
FROM "Lodge" l
WHERE l."status" = 'active'
  AND NOT EXISTS (SELECT 1 FROM "FinancialAccount" f WHERE f."lodgeId" = l."id" AND f."purpose" = 'tronco');

INSERT INTO "FinancialAccount" ("id", "lodgeId", "name", "kind", "purpose", "openingBalance", "updatedAt")
SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text || l."id" || 'd'), 1, 24), l."id",
       'Caixa de Doações e Contribuições', 'cash', 'donations', 0, CURRENT_TIMESTAMP
FROM "Lodge" l
WHERE l."status" = 'active'
  AND NOT EXISTS (SELECT 1 FROM "FinancialAccount" f WHERE f."lodgeId" = l."id" AND f."purpose" = 'donations');
