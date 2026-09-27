// Modalidades do fornecimento de materiais ao obreiro. Regras puras (sem banco),
// usadas pela API de fornecimento e pela tela de Materiais.
//
//   loan      empréstimo: o material é da loja, fica com o obreiro sob termo de
//             responsabilidade e volta (issued → returned | lost)
//   potencia  cedido pela Potência (ex.: rituais por determinação da Grande Loja):
//             nunca foi da loja, não mexe no estoque, sem custo, é do obreiro
//   sale      venda: sai do estoque da loja em definitivo e gera conta a receber
//   donation  doação da loja: sai do estoque em definitivo, sem custo ao obreiro
//
// Só o empréstimo volta; nas outras três o material passa a ser do obreiro, o
// registro nasce "delivered" e o documento é o Termo de entrega.

export const SUPPLY_KINDS = ['loan', 'potencia', 'sale', 'donation'] as const;
export type SupplyKind = (typeof SUPPLY_KINDS)[number];

export const SUPPLY_KIND_LABEL: Record<SupplyKind, string> = {
  loan: 'Empréstimo',
  potencia: 'Cedido pela Potência',
  sale: 'Venda',
  donation: 'Doação da loja',
};

/** Código do plano de contas da receita de venda (MASONIC_CHART_OF_ACCOUNTS). */
export const SALE_CHART_CODE = '1.2.04';

export function isSupplyKind(v: unknown): v is SupplyKind {
  return typeof v === 'string' && (SUPPLY_KINDS as readonly string[]).includes(v);
}

/** O material passa a ser do obreiro (não volta à loja). */
export function isPermanent(kind: SupplyKind): boolean {
  return kind !== 'loan';
}

/** Precisa de unidade disponível no estoque da loja para ser registrado. */
export function needsLodgeStock(kind: SupplyKind): boolean {
  return kind !== 'potencia';
}

/** Baixa a quantidade cadastrada do material (a unidade deixa a loja para sempre). */
export function removesFromCatalog(kind: SupplyKind): boolean {
  return kind === 'sale' || kind === 'donation';
}

/**
 * Venda (tem valor) e doação (baixa definitiva do estoque) são de quem cuida do cadastro
 * de materiais (materials:write — Secretário, Venerável, Administrador). O Arquiteto opera
 * o inventário (empréstimo, entrega da Potência), mas não lida com valores nem decide baixa.
 */
export function needsCatalogManager(kind: SupplyKind): boolean {
  return kind === 'sale' || kind === 'donation';
}

export function initialStatus(kind: SupplyKind): 'issued' | 'delivered' {
  return kind === 'loan' ? 'issued' : 'delivered';
}

/** Um empréstimo ainda com o obreiro pode virar outra modalidade (ex.: era ritual da Potência). */
export function canConvert(from: { kind: string; status: string }, to: SupplyKind): boolean {
  return from.kind === 'loan' && from.status === 'issued' && to !== 'loan';
}

/** Origem do material, para o texto do Termo de entrega. */
export function deliveryStatement(kind: SupplyKind, powerName: string | null): string {
  switch (kind) {
    case 'potencia':
      return `fornecido${powerName ? ` pela ${powerName}` : ' pela Potência'}, sem custo para a loja e para o obreiro`;
    case 'sale':
      return 'adquirido pelo obreiro junto à loja';
    case 'donation':
      return 'doado pela loja, sem custo para o obreiro';
    default:
      return 'emprestado pela loja';
  }
}
