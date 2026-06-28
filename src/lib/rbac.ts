import { prismaAdmin } from '@/lib/prisma';

export type Resource = 'members' | 'documents' | 'messages' | 'accounts' | 'portal' | 'campaigns';
export type Action = 'read' | 'write';

export const RESOURCES: Resource[] = ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns'];
export const ACTIONS: Action[] = ['read', 'write'];
export const ROLES = ['admin', 'venerable', 'treasurer', 'secretary', 'member', 'hospitaller'] as const;
export type Role = (typeof ROLES)[number];

// Política padrão (fallback). Lojas sem linhas em RolePermission usam isto.
// É a fonte de verdade para semear o RBAC persistido de cada loja.
const DEFAULT_POLICY: Record<string, { read: Resource[]; write: Resource[] }> = {
  admin: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns'],
    write: ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns'],
  },
  venerable: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns'],
    write: ['documents', 'messages', 'portal', 'campaigns'],
  },
  treasurer: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns'],
    write: ['messages', 'accounts', 'portal'],
  },
  secretary: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns'],
    write: ['members', 'documents', 'messages', 'portal'],
  },
  member: {
    read: ['portal'],
    write: ['portal'],
  },
  // Hospitaleiro: contato com irmãos (somente leitura), gestão de campanhas de
  // benemerência, leitura do Tronco (accounts) e envio de convocações (messages).
  hospitaller: {
    read: ['members', 'accounts', 'portal', 'campaigns', 'messages'],
    write: ['campaigns', 'messages', 'portal'],
  },
};

export function normalizeRole(role?: string | null) {
  if (!role) return 'member';
  return role.toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Camada estática (síncrona) — fallback e back-compat com os endpoints atuais.
// ---------------------------------------------------------------------------

export function canAccess(role: string | undefined | null, resource: Resource, action: Action) {
  const normalized = normalizeRole(role);
  const policy = DEFAULT_POLICY[normalized];
  if (!policy) {
    return false;
  }

  if (action === 'read') {
    return policy.read.includes(resource);
  }

  return policy.write.includes(resource);
}

export function canAccessAny(role: string | undefined | null, resources: Resource[], action: Action) {
  return resources.some((resource) => canAccess(role, resource, action));
}

export function requireAccess(role: string | undefined | null, resource: Resource, action: Action) {
  if (!canAccess(role, resource, action)) {
    return { ok: false, status: 403, error: 'Acesso negado.' } as const;
  }

  return { ok: true } as const;
}

// ---------------------------------------------------------------------------
// Camada persistida (assíncrona) — lê a matriz por loja de RolePermission.
// Se a loja não tem linhas, cai no DEFAULT_POLICY acima.
// ---------------------------------------------------------------------------

type PolicySet = Set<string>; // chaves "role:resource:action" permitidas

const policyCache = new Map<string, { allowed: PolicySet; expires: number }>();
const POLICY_TTL_MS = 30_000;

function keyOf(role: string, resource: string, action: string) {
  return `${role}:${resource}:${action}`;
}

/** Política derivada do DEFAULT_POLICY como conjunto de chaves permitidas. */
export function defaultPolicySet(): PolicySet {
  const set: PolicySet = new Set();
  for (const [role, policy] of Object.entries(DEFAULT_POLICY)) {
    for (const r of policy.read) set.add(keyOf(role, r, 'read'));
    for (const r of policy.write) set.add(keyOf(role, r, 'write'));
  }
  return set;
}

/** Lista achatada dos padrões — usada para semear/inicializar uma loja. */
export function defaultPermissionRows() {
  const rows: { role: Role; resource: Resource; action: Action; allowed: boolean }[] = [];
  for (const role of ROLES) {
    const policy = DEFAULT_POLICY[role];
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        const allowed =
          action === 'read' ? policy.read.includes(resource) : policy.write.includes(resource);
        rows.push({ role, resource, action, allowed });
      }
    }
  }
  return rows;
}

export function invalidateLodgePolicy(lodgeId: string) {
  policyCache.delete(lodgeId);
}

/**
 * Carrega o conjunto de permissões da loja. Usa prismaAdmin (filtrando por
 * lodgeId explicitamente) porque a checagem ocorre antes do withTenant.
 * Retorna null quando a loja ainda não personalizou (sem linhas) → o caller
 * deve usar o DEFAULT_POLICY.
 */
async function loadLodgePolicy(lodgeId: string): Promise<PolicySet | null> {
  const cached = policyCache.get(lodgeId);
  if (cached && cached.expires > Date.now()) {
    return cached.allowed.size > 0 ? cached.allowed : null;
  }

  let rows: { role: string; resource: string; action: string; allowed: boolean }[] = [];
  try {
    rows = await prismaAdmin.rolePermission.findMany({
      where: { lodgeId },
      select: { role: true, resource: true, action: true, allowed: true },
    });
  } catch {
    // Falha de leitura (ex.: tabela ainda não migrada) → trata como "sem custom".
    rows = [];
  }

  const allowed: PolicySet = new Set();
  for (const row of rows) {
    if (row.allowed) allowed.add(keyOf(normalizeRole(row.role), row.resource, row.action));
  }

  policyCache.set(lodgeId, { allowed, expires: Date.now() + POLICY_TTL_MS });
  return rows.length > 0 ? allowed : null;
}

/** Versão DB-aware do canAccess. */
export async function canLodgeAccess(
  lodgeId: string | undefined | null,
  role: string | undefined | null,
  resource: Resource,
  action: Action,
): Promise<boolean> {
  const normalized = normalizeRole(role);
  if (!lodgeId) return canAccess(normalized, resource, action);

  const policy = await loadLodgePolicy(lodgeId);
  if (!policy) return canAccess(normalized, resource, action); // loja sem custom → padrão
  return policy.has(keyOf(normalized, resource, action));
}

/** Versão DB-aware do requireAccess, com o mesmo formato de retorno. */
export async function requireLodgeAccess(
  lodgeId: string | undefined | null,
  role: string | undefined | null,
  resource: Resource,
  action: Action,
) {
  if (!(await canLodgeAccess(lodgeId, role, resource, action))) {
    return { ok: false, status: 403, error: 'Acesso negado.' } as const;
  }
  return { ok: true } as const;
}

/**
 * Retorna a matriz efetiva da loja (padrões + customizações) para a UI de admin.
 * Garante que toda combinação role×resource×action tenha um valor booleano.
 */
export async function getEffectiveMatrix(lodgeId: string) {
  const loaded = await loadLodgePolicy(lodgeId);
  const customized = loaded !== null;
  const policy = loaded ?? defaultPolicySet();
  const matrix: Record<string, Record<string, Record<string, boolean>>> = {};
  for (const role of ROLES) {
    matrix[role] = {};
    for (const resource of RESOURCES) {
      matrix[role][resource] = {};
      for (const action of ACTIONS) {
        matrix[role][resource][action] = policy.has(keyOf(role, resource, action));
      }
    }
  }
  return { matrix, customized };
}
