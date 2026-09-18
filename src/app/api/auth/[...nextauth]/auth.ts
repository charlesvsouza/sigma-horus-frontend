import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { isAccountUsable, isLockedOut, LOGIN_WINDOW_MS, SESSION_REVALIDATE_TTL_MS } from '@/lib/auth-policy';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role?: string;
      lodgeId?: string;
      memberId?: string | null;
      mustChangePassword?: boolean;
      /** Sessão aberta via /plataforma/entrar (dono da plataforma logado como
       * este admin) — usado por logAudit() para marcar as ações feitas nela
       * sem precisar tocar em cada rota que já chama logAudit. */
      viaSuperadmin?: boolean;
    };
  }
}

// Cache curto (por instância) da revalidação do usuário na sessão.
const sessionUserCache = new Map<string, { at: number; value: SessionUser | null }>();
interface SessionUser { role: string; lodgeId: string; memberId: string | null; mustChangePassword: boolean }

/** Descarta o cache do usuário (chamado quando o papel/status muda nesta instância). */
export function invalidateSessionUser(id: string) {
  sessionUserCache.delete(id);
}

async function loadSessionUser(id: string): Promise<SessionUser | null> {
  const hit = sessionUserCache.get(id);
  if (hit && Date.now() - hit.at < SESSION_REVALIDATE_TTL_MS) return hit.value;
  const u = await prismaAdmin.user.findUnique({
    where: { id },
    select: { status: true, role: true, lodgeId: true, memberId: true, mustChangePassword: true, lodge: { select: { status: true } } },
  });
  const value = isAccountUsable(u, u?.lodge)
    ? { role: u!.role, lodgeId: u!.lodgeId, memberId: u!.memberId, mustChangePassword: u!.mustChangePassword }
    : null;
  sessionUserCache.set(id, { at: Date.now(), value });
  return value;
}

export const authOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt' as const },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // E-mails são gravados em minúsculas (cadastro); normaliza o digitado.
        const user = await prismaAdmin.user.findUnique({
          where: { email: String(credentials.email).trim().toLowerCase() },
          include: { lodge: { select: { status: true } } },
        });

        if (!user) return null;
        // Usuário desativado (ou loja encerrada) não entra.
        if (!isAccountUsable(user, user.lodge)) return null;

        // Trava contra força bruta: muitas senhas erradas seguidas bloqueiam a conta
        // por alguns minutos (contagem via AuditLog, sem coluna nova).
        const failures = await prismaAdmin.auditLog.count({
          where: { userId: user.id, entity: 'login_failed', createdAt: { gte: new Date(Date.now() - LOGIN_WINDOW_MS) } },
        });
        if (isLockedOut(failures)) return null;

        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!valid) {
          await prismaAdmin.auditLog
            .create({ data: { lodgeId: user.lodgeId, userId: user.id, action: 'CREATE', entity: 'login_failed', entityId: user.id } })
            .catch(() => {});
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          lodgeId: user.lodgeId,
          memberId: user.memberId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
    // Entrada do dono da plataforma em qualquer loja ativa, sem senha —
    // autenticado pelo PLATFORM_OWNER_TOKEN (mesmo segredo de /plataforma/*).
    // "Loga como" o admin real da loja (sessão de verdade, RBAC normal),
    // registrando a entrada em AuditLog para haver rastro de quem/quando.
    Credentials({
      id: 'platform-impersonate',
      credentials: {
        platformToken: { label: 'Token', type: 'password' },
        lodgeId: { label: 'Loja', type: 'text' },
      },
      async authorize(credentials) {
        const secret = process.env.PLATFORM_OWNER_TOKEN;
        const token = credentials?.platformToken ? String(credentials.platformToken) : '';
        if (!secret || !token || token !== secret) return null;

        const lodgeId = credentials?.lodgeId ? String(credentials.lodgeId) : '';
        if (!lodgeId) return null;

        const lodge = await prismaAdmin.lodge.findFirst({ where: { id: lodgeId, status: 'active' } });
        if (!lodge) return null;

        const target =
          (await prismaAdmin.user.findFirst({ where: { lodgeId, role: 'admin', status: 'active' }, orderBy: { createdAt: 'asc' } })) ??
          (await prismaAdmin.user.findFirst({ where: { lodgeId, status: 'active' }, orderBy: { createdAt: 'asc' } }));
        if (!target) return null;

        await withTenant(lodgeId, (db) =>
          logAudit(db, {
            lodgeId,
            userId: target.id,
            action: 'CREATE',
            entity: 'platform_impersonation',
            entityId: lodgeId,
            metadata: { via: 'platform-owner-token', asUserId: target.id },
          }),
        );

        return {
          id: target.id,
          name: `${target.name} (superadmin)`,
          email: target.email,
          role: target.role,
          lodgeId: target.lodgeId,
          memberId: target.memberId,
          mustChangePassword: false,
          viaSuperadmin: true,
        };
      },
    }),
  ],
  pages: { signIn: '/login' },
  callbacks: {
    // Tipos dos callbacks do next-auth v5 sem module augmentation (o app usa
    // casts explícitos abaixo em vez de aumentar Session/JWT/User globalmente).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, trigger }: { token: any; user?: any; trigger?: string }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.lodgeId = user.lodgeId;
        token.memberId = user.memberId ?? null;
        token.mustChangePassword = Boolean(user.mustChangePassword);
        token.viaSuperadmin = Boolean(user.viaSuperadmin);
      } else if (token.id) {
        // Revalida a cada requisição (com cache curto por instância): o token
        // guarda papel/loja do login e, sem isso, desativar ou rebaixar um usuário
        // em "Usuários & acessos" só valeria no próximo login. Também preenche
        // memberId em sessões antigas que não o tinham.
        const fresh = await loadSessionUser(token.id as string);
        if (!fresh) {
          token.invalid = true;
        } else {
          token.invalid = false;
          token.role = fresh.role;
          token.lodgeId = fresh.lodgeId;
          token.memberId = fresh.memberId;
          if (!fresh.mustChangePassword) token.mustChangePassword = false;
        }
      }
      // Após o usuário trocar a senha, o cliente chama update() para limpar a flag.
      if (trigger === 'update') {
        token.mustChangePassword = false;
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      // Usuário desativado/removido (ou loja encerrada): sem usuário na sessão →
      // rotas respondem 401 e o layout redireciona para o login.
      if (token.invalid) return { ...session, user: undefined };
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.lodgeId = token.lodgeId as string;
        session.user.memberId = (token.memberId as string | null) ?? null;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.viaSuperadmin = Boolean(token.viaSuperadmin);
      }
      return session;
    },
  },
};

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth(authOptions);
