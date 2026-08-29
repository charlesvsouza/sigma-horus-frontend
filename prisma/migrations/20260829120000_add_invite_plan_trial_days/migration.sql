-- Convites: permite override de plano e duração do trial por convite
-- (ex.: convite especial de 60 dias no plano Loja), mantendo o padrão
-- atual (TRIAL_PLAN/TRIAL_DAYS = Oficina/10 dias) quando nulo.

ALTER TABLE "Invitation"
  ADD COLUMN "plan" TEXT,
  ADD COLUMN "trialDays" INTEGER;
