-- Garante que o role sigma_app existe com as permissões corretas.
-- Idempotente: pode ser reaplicado sem erro.
-- O role é usado pelo client Prisma `prisma` (APP_DATABASE_URL) e tem NOBYPASSRLS
-- para que o RLS por lodge_id funcione em todas as queries de tenant.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sigma_app') THEN
    CREATE ROLE sigma_app WITH LOGIN NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO sigma_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sigma_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sigma_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sigma_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sigma_app;
