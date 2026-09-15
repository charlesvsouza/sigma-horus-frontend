import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role?: string;
      lodgeId?: string;
      memberId?: string | null;
      mustChangePassword?: boolean;
    };
  }
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

        const user = await prismaAdmin.user.findUnique({
          where: { email: String(credentials.email) },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;

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
      } else if (token.id && token.memberId === undefined) {
        // Sessão emitida antes do campo memberId existir neste callback (ou
        // seja, antes de 2026-06-28) nunca teve essa propriedade preenchida —
        // sem isso, telas que dependem da identidade do membro (Meu Portal,
        // aviso do Art. 002) ficam vazias até o usuário deslogar e logar de
        // novo. Preenche uma vez, sozinho, na próxima requisição.
        const dbUser = await prismaAdmin.user.findUnique({ where: { id: token.id as string }, select: { memberId: true } });
        token.memberId = dbUser?.memberId ?? null;
      }
      // Após o usuário trocar a senha, o cliente chama update() para limpar a flag.
      if (trigger === 'update') {
        token.mustChangePassword = false;
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.lodgeId = token.lodgeId as string;
        session.user.memberId = (token.memberId as string | null) ?? null;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
};

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth(authOptions);
