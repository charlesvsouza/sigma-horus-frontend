-- Aplica RLS nas tabelas Document e MessageLog
-- Essas tabelas foram criadas após a migration inicial (20260625080000_enable_rls)
-- e nunca receberam ENABLE ROW LEVEL SECURITY.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Document', 'MessageLog']
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
