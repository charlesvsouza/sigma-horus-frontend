-- Fórmula de abertura dos documentos oficiais da loja (Composição, Termo de
-- responsabilidade). Configurável por loja porque varia entre ritos/potências;
-- nula = o documento sai sem fórmula.

ALTER TABLE "Lodge" ADD COLUMN "openingFormula" TEXT;
