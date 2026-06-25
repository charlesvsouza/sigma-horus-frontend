import { getServerSession } from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth';

export async function auth() {
  return getServerSession(authOptions as NextAuthOptions);
}
