import { Skeleton, SkeletonCard } from '@/components/ui';

// Mostrado enquanto uma tela do painel carrega no servidor (troca de página, refresh de dados).
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 lg:px-8" role="status" aria-live="polite" aria-label="Carregando">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-64" />
        <Skeleton variant="text" className="w-96 max-w-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
