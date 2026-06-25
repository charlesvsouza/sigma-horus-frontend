type Resource = 'members' | 'documents' | 'messages' | 'accounts' | 'portal';
type Action = 'read' | 'write';

const roleMap: Record<string, { read: Resource[]; write: Resource[] }> = {
  admin: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal'],
    write: ['members', 'documents', 'messages', 'accounts', 'portal'],
  },
  venerable: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal'],
    write: ['documents', 'messages', 'portal'],
  },
  treasurer: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal'],
    write: ['messages', 'accounts', 'portal'],
  },
  secretary: {
    read: ['members', 'documents', 'messages', 'accounts', 'portal'],
    write: ['members', 'documents', 'messages', 'portal'],
  },
  member: {
    read: ['portal'],
    write: ['portal'],
  },
};

export function normalizeRole(role?: string | null) {
  if (!role) return 'member';
  return role.toLowerCase().trim();
}

export function canAccess(role: string | undefined | null, resource: Resource, action: Action) {
  const normalized = normalizeRole(role);
  const policy = roleMap[normalized];
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
