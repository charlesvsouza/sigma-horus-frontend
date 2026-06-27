-- Identidade maçônica (rito/potência) e agenda padrão de sessões da loja.
ALTER TABLE "Lodge"
  ADD COLUMN "riteName" TEXT,
  ADD COLUMN "powerName" TEXT,
  ADD COLUMN "sessionWeekdays" TEXT,
  ADD COLUMN "sessionFrequency" TEXT DEFAULT 'weekly';
