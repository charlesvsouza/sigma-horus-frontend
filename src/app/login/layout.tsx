import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

// Área transacional: fora do índice dos buscadores. NÃO bloquear no robots.txt — o Google precisa
// conseguir abrir a página para ler o noindex.
export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
};

// Quem já está conectado não vê a tela de login: vai direto ao painel. Antes, abrir /login com a sessão ativa
// mostrava o formulário e a seta Voltar do navegador levava de volta ao painel "ainda conectado". Se a sessão caiu
// (expirou ou saiu), auth() não devolve usuário e o formulário aparece normalmente.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user) redirect('/dashboard');
  return children;
}
