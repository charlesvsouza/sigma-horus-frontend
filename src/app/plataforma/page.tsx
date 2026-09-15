import Link from 'next/link';
import { Card, CardDescription, CardTitle } from '@/components/ui';

// Hub do dono da plataforma (não é multi-tenant) — ponto de entrada único
// pros painéis internos, cada um com seu próprio gate por PLATFORM_OWNER_TOKEN.
export default function PlataformaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sigma-blue-deep px-6 py-12">
      <div className="w-full max-w-2xl">
        <p className="text-center text-[0.6rem] uppercase tracking-[0.3em] text-gold/60">Sigma Horus — Plataforma</p>
        <h1 className="mt-3 text-center text-2xl font-bold text-sand-light">Área do dono da plataforma</h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-sand-dark">
          Painéis internos, fora do fluxo normal de login das lojas.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <Link href="/plataforma/convites" className="block h-full">
            <Card variant="interactive" className="h-full">
              <CardTitle>Convites</CardTitle>
              <CardDescription>Gerar e listar convites de cadastro por teste (acesso somente por convite).</CardDescription>
            </Card>
          </Link>

          <Link href="/plataforma/entrar" className="block h-full">
            <Card variant="interactive" className="h-full">
              <CardTitle>Entrar como superadmin</CardTitle>
              <CardDescription>Acessar o painel de qualquer loja ativa como o admin dela, para suporte.</CardDescription>
            </Card>
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-sand-dark">
          <Link href="/plataforma/backups" className="text-gold-light hover:text-gold">Backups da plataforma →</Link>
        </p>
      </div>
    </main>
  );
}
