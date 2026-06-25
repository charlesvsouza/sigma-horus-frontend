-- Row-Level Security (RLS) por lodge_id
-- A app conecta como o role NOBYPASSRLS `sigma_app`; operações de sistema
-- (login, onboarding, webhook Stripe) usam o superuser, que bypassa RLS.
-- O contexto do tenant é setado por transação via set_config('app.current_lodge_id', ...).

-- 1. Privilégios do role de aplicação
GRANT USAGE ON SCHEMA public TO sigma_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sigma_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sigma_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sigma_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sigma_app;

-- 2. RLS nas tabelas de tenant (predicado em "lodgeId")
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'User','Member','Account','Invoice','Payment','Subscription','AuditLog',
    'Session','Office','Term','CashClose','Rite','Power','Attendance','MemberOffice'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING ("lodgeId" = current_setting(''app.current_lodge_id'', true)) '
      'WITH CHECK ("lodgeId" = current_setting(''app.current_lodge_id'', true))',
      t
    );
  END LOOP;
END $$;

-- 3. RLS na tabela raiz Lodge (predicado em "id")
ALTER TABLE "Lodge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lodge" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Lodge";
CREATE POLICY tenant_isolation ON "Lodge"
  USING ("id" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("id" = current_setting('app.current_lodge_id', true));
