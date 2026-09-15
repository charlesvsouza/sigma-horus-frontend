-- Contraparte externa (fornecedor/cliente que não é membro da loja) em
-- Account: nome + documento livres, usados quando memberId é null. Suporta
-- a migração de dados financeiros legados (ex.: contas a pagar/receber de
-- fornecedores) e qualquer loja que precise registrar pagamentos/recebimentos
-- de não-membros sem um cadastro completo.

ALTER TABLE "Account" ADD COLUMN "counterpartyName" TEXT;
ALTER TABLE "Account" ADD COLUMN "counterpartyDoc" TEXT;
