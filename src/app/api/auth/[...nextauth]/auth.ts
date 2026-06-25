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
        };
      },
    }),
  ],
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.lodgeId = user.lodgeId;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.lodgeId = token.lodgeId as string;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export const { GET, POST } = handler;
export const auth = handler.auth;
export const signIn = handler.signIn;
export const signOut = handler.signOut;
export default handler;
