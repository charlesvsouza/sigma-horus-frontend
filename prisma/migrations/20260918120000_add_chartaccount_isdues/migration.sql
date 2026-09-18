-- ChartAccount.isDues: a categoria "Mensalidades" passa a marcar o lançamento e a
-- cobrança gerados a partir dela como mensalidade (base do Art. 002), em vez do
-- checkbox manual no lançamento.
ALTER TABLE "ChartAccount" ADD COLUMN "isDues" BOOLEAN NOT NULL DEFAULT false;

-- Lojas existentes: Mensalidades (1.1.01) já nasce como mensalidade.
UPDATE "ChartAccount" SET "isDues" = true WHERE "code" = '1.1.01';

-- 1.1.02 deixa de agrupar as três taxas: fica só Iniciação (Elevação/Exaltação
-- entram como 1.1.08/1.1.09 no "Atualizar plano de contas"). Só renomeia o nome
-- original, preservando nome customizado; os lançamentos antigos mantêm o vínculo.
UPDATE "ChartAccount" SET "name" = 'Taxa de Iniciação'
 WHERE "code" = '1.1.02' AND "name" = 'Taxas (Iniciação, Elevação, Exaltação)';
