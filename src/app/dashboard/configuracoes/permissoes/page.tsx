import { auth } from '@/lib/auth';
import { ACTIONS, MATRIX_ROLES, RESOURCES, getEffectiveMatrix, normalizeRole } from '@/lib/rbac';
import PermissoesClient from './PermissoesClient';

// Server Component: matriz RBAC efetiva da loja (admin-only).
export default async function PermissoesPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const isAdmin = !!lodgeId && normalizeRole(session?.user?.role) === 'admin';

  if (!isAdmin) {
    return <PermissoesClient initialMatrix={{}} roles={[]} resources={[]} actions={[]} initialCustomized={false} denied />;
  }

  const { matrix, customized } = await getEffectiveMatrix(String(lodgeId));
  return (
    <PermissoesClient
      initialMatrix={matrix as Record<string, Record<string, Record<string, boolean>>>}
      roles={[...MATRIX_ROLES]}
      resources={[...RESOURCES]}
      actions={[...ACTIONS]}
      initialCustomized={customized}
      denied={false}
    />
  );
}
