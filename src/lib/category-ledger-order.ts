/**
 * Ordem de leitura do razão por categoria.
 *
 * Regra do Venerável: o relatório do **Tronco de Solidariedade** é lido da sessão mais recente
 * para a mais antiga (é o que ele confere primeiro: o que entrou na última sessão). Os demais
 * razões continuam cronológicos, do mais antigo para o mais novo, como manda a leitura contábil.
 *
 * Vale a ordem recente quando o filtro é o fundo Tronco (`?fund=tronco`) ou quando todas as
 * categorias marcadas são do Tronco — inclusive as marcadas como "solidariedade".
 */
export interface CategoriaMarcada {
  fundPurpose?: string | null;
  isSolidarity?: boolean;
}

export function ehRelatorioDoTronco(fund: string | undefined, marcadas: CategoriaMarcada[]): boolean {
  // O filtro de fundo, quando existe, manda: `?fund=donations` não vira ordem recente.
  if (fund) return fund === 'tronco';
  if (marcadas.length === 0) return false;
  return marcadas.every((c) => c.fundPurpose === 'tronco' || c.isSolidarity === true);
}

/** Da sessão mais recente para a mais antiga. Não muda o saldo de cada lançamento, só a leitura. */
export function naOrdemRecente<T>(rows: T[], recente: boolean): T[] {
  return recente ? [...rows].reverse() : rows;
}
