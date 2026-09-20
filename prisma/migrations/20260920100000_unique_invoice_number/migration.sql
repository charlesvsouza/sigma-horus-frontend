-- Número de cobrança único por loja.
--
-- O gerador antigo contava as cobranças do mês (count + 1): apagar uma cobrança no meio da série
-- fazia o próximo número repetir um já existente. O gerador agora parte do maior número, e este
-- índice é a barreira no banco (inclui número digitado à mão).
--
-- Antes de criar o índice, renomeia as duplicatas que já existirem: a mais antiga de cada
-- (lodgeId, number) mantém o número; as demais ganham o sufixo "-D2", "-D3"… O número é só um
-- rótulo (o Asaas liga pela chave interna da cobrança), então nada externo depende dele.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "lodgeId", "number" ORDER BY "createdAt", id) AS rn
  FROM "Invoice"
)
UPDATE "Invoice" AS i
SET "number" = i."number" || '-D' || ranked.rn
FROM ranked
WHERE i.id = ranked.id AND ranked.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_lodgeId_number_key" ON "Invoice"("lodgeId", "number");
