import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const authConfig = {
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

        const user = await prisma.user.findUnique({
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
        } as typeof user & { role: string };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        const userWithRole = user as { role?: string };
        if (userWithRole.role) {
          token.role = userWithRole.role;
        }
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        const sessionUser = session.user as typeof session.user & { role?: string };
        sessionUser.role = token.role as string;
      }
      return session;
    },
  },
};

const handler = NextAuth(authConfig);

export const { GET, POST } = handler;
export const auth = handler.auth;

export const signIn = handler.signIn;
export const signOut = handler.signOut;
