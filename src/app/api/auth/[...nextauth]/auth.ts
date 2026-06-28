import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prismaAdmin } from '@/lib/prisma';
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
  ],
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user, trigger }: { token: any; user?: any; trigger?: string }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.lodgeId = user.lodgeId;
        token.memberId = user.memberId ?? null;
        token.mustChangePassword = Boolean(user.mustChangePassword);
      }
      // Após o usuário trocar a senha, o cliente chama update() para limpar a flag.
      if (trigger === 'update') {
        token.mustChangePassword = false;
      }
      return token;
    },
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
