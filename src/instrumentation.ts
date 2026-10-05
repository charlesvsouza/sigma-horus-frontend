// Gancho do Next.js: toda falha não tratada em rota de API, página (servidor), ação ou proxy passa
// por aqui. Só no runtime Node (o banco não roda no edge). Ver lib/error-monitor.ts.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { recordError } = await import('@/lib/error-monitor');
  const e = err as { message?: unknown; stack?: unknown; digest?: unknown };
  await recordError({
    source: 'server',
    route: request.path,
    method: request.method,
    message: e?.message ?? err,
    stack: e?.stack,
    digest: typeof e?.digest === 'string' ? e.digest : null,
  });
}
