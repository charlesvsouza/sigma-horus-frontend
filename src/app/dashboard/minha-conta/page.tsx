import { auth } from '@/lib/auth';
import { prismaAdmin } from '@/lib/prisma';
import MinhaContaClient from './MinhaContaClient';

// Server Component: dados do PRÓPRIO usuário logado. A escrita é sempre reconferida pelas rotas
// /api/account/*. Obreiro (com cadastro de membro) só troca a senha aqui — nome e e-mail são os do cadastro.
export default async function MinhaContaPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const user = await prismaAdmin.user.findUnique({ where: { id: userId }, select: { name: true, email: true, role: true, memberId: true } });
  if (!user) return null;
  return <MinhaContaClient name={user.name} email={user.email} role={user.role} isMember={!!user.memberId} />;
}
