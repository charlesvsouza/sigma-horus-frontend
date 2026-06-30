import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import ChangePasswordForm from './change-password-form';

// Fora do layout do dashboard (evita loop com o gate de mustChangePassword).
export default async function TrocarSenhaPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sigma-blue-deep px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-sigma-blue-deep via-sigma-blue-dark to-sigma-blue-deep" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/[8%] bg-sigma-blue-dark/80 p-8">
        <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gold/60">Sigma Horus</p>
        <h1 className="mt-2 text-xl font-semibold text-sand-light">
          {session.user.mustChangePassword ? 'Defina sua senha' : 'Trocar senha'}
        </h1>
        <p className="mt-1 text-sm text-sand-dark">
          {session.user.mustChangePassword
            ? 'Por segurança, defina uma nova senha para o seu primeiro acesso.'
            : 'Informe a senha atual e a nova senha.'}
        </p>
        <ChangePasswordForm email={session.user.email} />
      </div>
    </main>
  );
}
