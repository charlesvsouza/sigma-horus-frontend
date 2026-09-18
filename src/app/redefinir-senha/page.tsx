import ResetPasswordForm from './reset-password-form';

// Página pública aberta pelo link do e-mail "Redefinição de senha".
export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sigma-blue-deep px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-sigma-blue-deep via-sigma-blue-dark to-sigma-blue-deep" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/8 bg-sigma-blue-dark/80 p-8">
        <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gold/60">Sigma Horus</p>
        <h1 className="mt-2 text-xl font-semibold text-sand-light">Definir nova senha</h1>
        <p className="mt-1 text-sm text-sand-dark">Escolha uma nova senha para a sua conta.</p>
        <ResetPasswordForm token={token ?? ''} />
      </div>
    </main>
  );
}
