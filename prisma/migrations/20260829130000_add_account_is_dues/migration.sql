-- Art. 002 (suspensão por inadimplência > 60 dias): marca quais contas a
-- receber são mensalidade do membro, para distinguir de cobranças pontuais
-- (evento, campanha etc.) na regra de 60 dias.
ALTER TABLE "Account" ADD COLUMN "isDues" BOOLEAN NOT NULL DEFAULT false;
