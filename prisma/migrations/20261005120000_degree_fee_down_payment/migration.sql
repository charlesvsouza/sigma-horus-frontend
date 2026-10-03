-- Entrada opcional nos planos de taxa de grau (entrada + N parcelas do saldo).
ALTER TABLE "DegreeFeePlan" ADD COLUMN "downPayment" DOUBLE PRECISION;
