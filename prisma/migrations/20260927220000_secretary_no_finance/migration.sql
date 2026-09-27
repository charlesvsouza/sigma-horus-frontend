-- A Secretaria deixa de ler o Financeiro (Contas, Cobranças, Pagamentos e relatórios financeiros)
-- — decisão do dono, 2026-09-27. O padrão mudou em lib/rbac.ts; aqui, nas lojas que já tinham
-- salvo a matriz de Permissões (a linha gravada vale mais que o padrão), a leitura é desligada.
-- O Administrador pode religar em Configurações → Permissões. Escrita já era negada.

UPDATE "RolePermission"
SET "allowed" = false
WHERE "role" = 'secretary' AND "resource" = 'accounts' AND "action" = 'read' AND "allowed" = true;
