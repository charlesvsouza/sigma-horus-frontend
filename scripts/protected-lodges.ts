// Lojas REAIS em operação: os scripts de escrita (importação, marcação de teste, desfazer) recusam
// gravar nelas, a menos que a flag explícita abaixo seja passada. As lojas de teste (ex.: horus-reaa)
// não estão aqui. A simulação (sem --yes) continua liberada.
export const PROTECTED_LODGE_SLUGS = ['amm139'];
export const OVERRIDE_FLAG = '--i-know-this-is-a-real-lodge';

/** Devolve a mensagem de recusa, ou null se pode gravar. */
export function refuseIfProtected(slug: string | undefined, argv: string[]): string | null {
  if (!slug || !PROTECTED_LODGE_SLUGS.includes(slug)) return null;
  if (argv.includes(OVERRIDE_FLAG)) return null;
  return `[RECUSADO] "${slug}" é uma loja REAL em operação. Estes scripts são para lojas de teste. Se é isso mesmo que você quer, repita com ${OVERRIDE_FLAG}.`;
}
