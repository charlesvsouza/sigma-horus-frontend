// Ordem de exibição dos cargos da loja. Os cargos de gestão vêm primeiro, na
// ordem cerimonial: Venerável Mestre, as duas Luzes (1º e 2º Vigilante), Orador,
// Secretário, Tesoureiro e Mestre de Cerimônias. Os demais cargos vêm depois, pela
// ordem cadastrada (Office.order) e, no empate, pelo nome.
//
// Por nome (e não só por Office.order) porque cargos criados à mão entram com a
// ordem padrão e ficariam fora do lugar, e porque a ordem semeada de cada rito
// varia (ex.: o Chanceler vem antes do Mestre de Cerimônias no REAA).

const GESTAO: string[][] = [
  ['veneravel mestre', 'veneravel'],
  ['1o vigilante', 'primeiro vigilante'],
  ['2o vigilante', 'segundo vigilante'],
  ['orador'],
  ['secretario'],
  ['tesoureiro'],
  ['mestre de cerimonias'],
];

const OTHERS_RANK = GESTAO.length + 1;

// Minúsculo, sem acento e com ordinais normalizados ("1º" → "1o").
function normalize(name: string) {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Posição do cargo entre os de gestão (1..7); cargos comuns ficam depois (8). */
export function officeRank(name: string): number {
  const n = normalize(name);
  const i = GESTAO.findIndex((names) => names.includes(n));
  return i === -1 ? OTHERS_RANK : i + 1;
}

/** Comparador para `Array.sort`: gestão primeiro, depois Office.order, depois nome. */
export function compareOffices(a: { name: string; order?: number | null }, b: { name: string; order?: number | null }): number {
  return (
    officeRank(a.name) - officeRank(b.name) ||
    (a.order ?? 999) - (b.order ?? 999) ||
    a.name.localeCompare(b.name, 'pt-BR')
  );
}
