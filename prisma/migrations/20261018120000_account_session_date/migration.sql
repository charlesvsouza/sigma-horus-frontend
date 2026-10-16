-- Tronco de sessão antiga (não cadastrada): guarda só o dia em que a sessão ocorreu.
ALTER TABLE "Account" ADD COLUMN "sessionDate" TIMESTAMP(3);
