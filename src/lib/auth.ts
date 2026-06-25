import { auth as nextAuth } from '@/app/api/auth/[...nextauth]/auth';

export async function auth() {
  return nextAuth();
}
