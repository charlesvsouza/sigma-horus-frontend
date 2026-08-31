-- Toggle por loja da régua automática do Art. 002 (afastamento por
-- mensalidade em atraso > 60 dias). Default true preserva o comportamento
-- atual de todas as lojas; o relatório de inadimplência não depende deste
-- flag, continua sempre disponível.

ALTER TABLE "Lodge" ADD COLUMN "art002Enabled" BOOLEAN NOT NULL DEFAULT true;
