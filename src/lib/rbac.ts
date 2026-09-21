import { prismaAdmin } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription-guard';

export type Resource = 'members' | 'documents' | 'messages' | 'accounts' | 'portal' | 'campaigns' | 'import' | 'materials' | 'inventory' | 'audit';
export type Action = 'read' | 'write';

// Ao adicionar um novo Resource aqui, lojas que já customizaram a matriz (têm
// linhas em RolePermission) não têm linhas para ele. Nesse caso vale o padrão
// (DEFAULT_POLICY) só para esse recurso — ver canLodgeAccess — até o Admin
// reabrir e salvar a tela de Permissões, que passa a persistir a escolha.
//
// 'audit' (trilha de auditoria): por padrão só o Administrador. Outro cargo só
// enxerga se o Administrador liberar em Configurações → Permissões.
//
// 'materials' = o CADASTRO da lista de materiais da loja (e a decisão sobre baixa/
// reposição). 'inventory' = a operação do dia a dia sobre essa lista: registrar
// ocorrências (desgaste, dano, perda) e fornecer/receber materiais emprestados.
// Separados para o Arquiteto operar o inventário sem poder editar o cadastro.
export const RESOURCES: Resource[] = ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns', 'import', 'materials', 'inventory', 'audit'];
export const ACTIONS: Action[] = ['read', 'write'];
export const ROLES = ['admin', 'venerable', 'treasurer', 'secretary', 'member', 'hospitaller'] as const;
export type Role = (typeof ROLES)[number];

// Papéis "por cargo": não são atribuídos a usuários (não entram em ROLES nem em
// Usuários & acessos). Valem para o obreiro que ocupa o cargo no veneralato
// ATIVO e SOMAM-SE ao papel dele — quando o veneralato encerra, o acesso some.
// Aparecem como coluna na matriz de Permissões, então só a matriz amplia/reduz.
export const CARGO_ROLES = ['architect'] as const;
export type CargoRole = (typeof CARGO_ROLES)[number];
export const MATRIX_ROLES: readonly string[] = [...ROLES, ...CARGO_ROLES];

// Nome do cargo (normalizado: minúsculo, sem acento) → papel por cargo.
const OFFICE_TO_CARGO_ROLE: Record<string, CargoRole> = { arquiteto: 'architect' };

// Política padrão (fallback). Lojas sem linhas em RolePermission usam isto.
// É a fonte de verdade para semear o RBAC persistido de cada loja.
const DEFAULT_POLICY: Record<string, { read: Resource[]; write: Resource[] }> = {
  admin: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns', 'import', 'materials', 'inventory', 'audit'],
    write: ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns', 'import', 'materials', 'inventory'],
  },
  venerable: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns', 'materials', 'inventory'],
    // O Venerável preside a loja e precisa editar cadastro de membro, cargos,
    // veneralato e cadastros mestre (ritos/potências) — não só a Secretaria. Também
    // cadastra os materiais e decide baixa/reposição (junto com Admin e Secretário).
    write: ['members', 'documents', 'messages', 'portal', 'campaigns', 'materials', 'inventory'],
  },
  treasurer: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns'],
    write: ['messages', 'accounts', 'portal'],
  },
  secretary: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal', 'campaigns', 'import', 'materials', 'inventory'],
    write: ['members', 'documents', 'messages', 'portal', 'import', 'materials', 'inventory'],
  },
  member: {
    read: ['portal', 'campaigns', 'documents'],
    write: ['portal'],
  },
  // Hospitaleiro: contato com irmãos (somente leitura), gestão de campanhas de
  // benemerência, leitura do Tronco (accounts) e envio de convocações (messages).
  hospitaller: {
    read: ['members', 'accounts', 'portal', 'campaigns', 'messages', 'documents'],
    write: ['campaigns', 'messages', 'portal'],
  },
  // Arquiteto (papel por cargo, soma-se ao papel do obreiro): vê a lista de
  // materiais e opera o inventário — registra desgaste/dano/perda e fornece/recebe
  // materiais —, mas NÃO edita o cadastro nem decide baixa/reposição, e não tem
  // acesso a valores (o Material não guarda custo; o Patrimônio é da Tesouraria).
  architect: {
    read: ['materials', 'inventory'],
    write: ['inventory'],
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

const policyCache = new Map<string, { allowed: PolicySet; customized: Set<string>; expires: number }>();
const POLICY_TTL_MS = 30_000;

function keyOf(role: string, resource: string, action: string) {
  return `${role}:${resource}:${action}`;
}

// A loja "personalizou" um par papel×recurso quando há linhas dele em
// RolePermission. Papel ou recurso novo (sem linhas) usa o padrão até o Admin
// salvar a matriz — assim lojas antigas não perdem/ganham acesso por surpresa.
function customKey(role: string, resource: string) {
  return `${role}:${resource}`;
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
  const rows: { role: string; resource: Resource; action: Action; allowed: boolean }[] = [];
  for (const role of MATRIX_ROLES) {
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

type LodgePolicy = { allowed: PolicySet; customized: Set<string> };

/**
 * Carrega as permissões persistidas da loja. Usa prismaAdmin (filtrando por
 * lodgeId explicitamente) porque a checagem ocorre antes do withTenant.
 * `customized` = pares papel×recurso que a loja já tem linhas em RolePermission
 * (par sem linhas — a loja não personalizou, ou o papel/recurso é novo — usa o DEFAULT_POLICY).
 * Retorna null quando a loja não personalizou nada.
 */
async function loadLodgePolicy(lodgeId: string): Promise<LodgePolicy | null> {
  const cached = policyCache.get(lodgeId);
  if (cached && cached.expires > Date.now()) {
    return cached.customized.size > 0 ? { allowed: cached.allowed, customized: cached.customized } : null;
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
  const customized = new Set<string>();
  for (const row of rows) {
    customized.add(customKey(normalizeRole(row.role), row.resource));
    if (row.allowed) allowed.add(keyOf(normalizeRole(row.role), row.resource, row.action));
  }

  policyCache.set(lodgeId, { allowed, customized, expires: Date.now() + POLICY_TTL_MS });
  return customized.size > 0 ? { allowed, customized } : null;
}

/** Decide uma permissão: persistida se a loja personalizou o recurso, senão o padrão. */
function decide(policy: LodgePolicy | null, normalizedRole: string, resource: Resource, action: Action): boolean {
  // O Administrador é fixo: a matriz personalizada da loja nunca o restringe (evita se trancar para fora).
  if (normalizedRole === 'admin') return canAccess('admin', resource, action);
  if (!policy || !policy.customized.has(customKey(normalizedRole, resource))) return canAccess(normalizedRole, resource, action);
  return policy.allowed.has(keyOf(normalizedRole, resource, action));
}

// ---------------------------------------------------------------------------
// Papéis por cargo (ex.: Arquiteto) — resolvidos pelo cargo no veneralato ativo.
// ---------------------------------------------------------------------------

const cargoCache = new Map<string, { roles: CargoRole[]; expires: number }>();

function normalizeOfficeName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Papel por cargo derivado de um nome de cargo (null se o cargo não concede nenhum). */
export function cargoRoleForOffice(officeName: string): CargoRole | null {
  return OFFICE_TO_CARGO_ROLE[normalizeOfficeName(officeName)] ?? null;
}

export function invalidateCargoRoles(lodgeId: string) {
  for (const key of cargoCache.keys()) if (key.startsWith(`${lodgeId}:`)) cargoCache.delete(key);
}

/** Papéis por cargo do obreiro no veneralato ATIVO da loja (vazio se não ocupa nenhum). */
export async function cargoRolesFor(lodgeId: string | null | undefined, memberId: string | null | undefined): Promise<CargoRole[]> {
  if (!lodgeId || !memberId) return [];
  const cacheKey = `${lodgeId}:${memberId}`;
  const cached = cargoCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.roles;

  let roles: CargoRole[] = [];
  try {
    const rows = await prismaAdmin.memberOffice.findMany({
      where: { lodgeId, memberId, term: { status: 'active' } },
      select: { office: { select: { name: true } } },
    });
    roles = [...new Set(rows.map((r) => cargoRoleForOffice(r.office.name)).filter((r): r is CargoRole => r !== null))];
  } catch {
    roles = [];
  }
  cargoCache.set(cacheKey, { roles, expires: Date.now() + POLICY_TTL_MS });
  return roles;
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
  return decide(await loadLodgePolicy(lodgeId), normalized, resource, action);
}

/**
 * Como canLodgeAccess, mas também soma os papéis por cargo do obreiro
 * (`memberId` da sessão) — ex.: o Arquiteto ganha o inventário sem trocar de papel.
 */
export async function canLodgeAccessFor(
  who: { lodgeId: string | undefined | null; role: string | undefined | null; memberId?: string | null },
  resource: Resource,
  action: Action,
): Promise<boolean> {
  if (await canLodgeAccess(who.lodgeId, who.role, resource, action)) return true;
  const cargoRoles = await cargoRolesFor(who.lodgeId, who.memberId);
  if (cargoRoles.length === 0) return false;
  const policy = who.lodgeId ? await loadLodgePolicy(who.lodgeId) : null;
  return cargoRoles.some((r) => decide(policy, r, resource, action));
}

/**
 * Versão DB-aware do requireAccess, com o mesmo formato de retorno. Passe
 * `memberId` (da sessão) nos recursos que também podem vir de um papel por cargo.
 */
export async function requireLodgeAccess(
  lodgeId: string | undefined | null,
  role: string | undefined | null,
  resource: Resource,
  action: Action,
  memberId?: string | null,
) {
  if (!(await canLodgeAccessFor({ lodgeId, role, memberId }, resource, action))) {
    return { ok: false, status: 403, error: 'Acesso negado.' } as const;
  }
  // Escrita exige assinatura vigente (a leitura segue liberada). Ver lib/subscription-guard.ts.
  if (action === 'write') return requireActiveSubscription(lodgeId);
  return { ok: true } as const;
}

// Não é role×resource×action da matriz de Permissões (não existe resource
// 'sessions') — é uma checagem fixa e intencional: só quem preside a loja
// (Administrador/Venerável) pode destrancar uma sessão já trancada, mesmo que
// o papel tenha members:write (Secretário, por exemplo, não pode).
export function canUnlockSession(role: string | undefined | null) {
  return role === 'admin' || role === 'venerable';
}

/**
 * Retorna a matriz efetiva da loja (padrões + customizações) para a UI de admin.
 * Garante que toda combinação role×resource×action tenha um valor booleano.
 */
export async function getEffectiveMatrix(lodgeId: string) {
  const loaded = await loadLodgePolicy(lodgeId);
  const customized = loaded !== null;
  const matrix: Record<string, Record<string, Record<string, boolean>>> = {};
  for (const role of MATRIX_ROLES) {
    matrix[role] = {};
    for (const resource of RESOURCES) {
      matrix[role][resource] = {};
      for (const action of ACTIONS) {
        matrix[role][resource][action] = decide(loaded, role, resource, action);
      }
    }
  }
  return { matrix, customized };
}
