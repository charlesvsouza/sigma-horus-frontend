// Baixa assistida por extrato (Modo Loja): para um crédito do extrato bancário que ainda não casa com
// nenhum pagamento lançado, sugere QUAL cobrança em aberto ele provavelmente quitou, pelo VALOR e pelo
// NOME do pagador (a descrição do Pix/TED costuma trazer o nome). Regras puras; quem confirma é a Tesouraria.

const STOPWORDS = new Set([
  'de', 'da', 'do', 'dos', 'das', 'e', 'pix', 'recebido', 'recebida', 'transferencia', 'transf', 'ted', 'doc', 'pagamento', 'pagto',
  'credito', 'deposito', 'dep', 'conta', 'banco', 'ltda', 'me', 'epp', 'sa', 'remetente', 'favorecido', 'cpf', 'cnpj', 'ag', 'cc', 'rem',
]);

/** Minúsculo, sem acento, só letras e espaços. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const tokens = (s: string) => normalizeText(s).split(' ').filter((t) => t.length >= 3 && !STOPWORDS.has(t));

export type NameMatch = 'strong' | 'weak' | 'none';

/** Quanto do nome do irmão aparece na descrição do lançamento: 2+ nomes = forte; 1 = fraco. */
export function nameMatch(description: string, memberName: string | null | undefined): NameMatch {
  if (!memberName) return 'none';
  const desc = new Set(tokens(description));
  const name = tokens(memberName);
  if (name.length === 0 || desc.size === 0) return 'none';
  const hits = name.filter((t) => desc.has(t)).length;
  if (hits >= 2 || (name.length === 1 && hits === 1)) return 'strong';
  return hits === 1 ? 'weak' : 'none';
}

export type AmountMatch = 'exact' | 'partial';

export interface SuggestAccount {
  accountId: string;
  title: string;
  memberName: string | null;
  balance: number;
  dueDate: Date;
}

export interface Suggestion extends SuggestAccount {
  amountMatch: AmountMatch;
  nameMatch: NameMatch;
  score: number;
}

const TOLERANCE = 0.005;

/**
 * Candidatas para um crédito de `amount`: o saldo da conta precisa ser igual (exato) ou maior (parcial);
 * saldo MENOR que o crédito nunca é sugerido (sobraria dinheiro). Entra se o valor é exato OU o nome
 * confere; ordena por confiança (valor exato + nome forte primeiro) e, no empate, pelo vencimento mais antigo.
 */
export function suggestAccounts(line: { amount: number; description: string }, accounts: SuggestAccount[], limit = 5): Suggestion[] {
  const out: Suggestion[] = [];
  for (const a of accounts) {
    if (a.balance + TOLERANCE < line.amount) continue;
    const amountMatch: AmountMatch = Math.abs(a.balance - line.amount) <= TOLERANCE ? 'exact' : 'partial';
    const name = nameMatch(line.description, a.memberName);
    if (amountMatch === 'partial' && name === 'none') continue;
    const score = (amountMatch === 'exact' ? 100 : 30) + (name === 'strong' ? 60 : name === 'weak' ? 20 : 0);
    out.push({ ...a, amountMatch, nameMatch: name, score });
  }
  return out.sort((x, y) => y.score - x.score || x.dueDate.getTime() - y.dueDate.getTime()).slice(0, limit);
}

/** Texto curto da confiança, para a tela. */
export function suggestionLabel(s: Pick<Suggestion, 'amountMatch' | 'nameMatch'>): string {
  if (s.amountMatch === 'exact' && s.nameMatch === 'strong') return 'Valor e nome conferem';
  if (s.amountMatch === 'exact' && s.nameMatch === 'weak') return 'Valor confere; nome parcial';
  if (s.amountMatch === 'exact') return 'Valor confere';
  return s.nameMatch === 'strong' ? 'Nome confere; valor parcial' : 'Nome parcial; valor parcial';
}
