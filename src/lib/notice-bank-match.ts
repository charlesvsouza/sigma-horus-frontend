// "Já paguei" × extrato bancário (Modo Loja). O Pix estático do portal leva o id da conta
// como identificador (txid); quando o banco traz esse identificador na descrição da linha,
// o casamento é certo. Sem ele, casa pelo MESMO valor num intervalo de dias do aviso — só
// quando é inequívoco (uma linha para um aviso e ninguém mais disputando). Lógica pura.

export const NOTICE_MATCH_DAYS = 3;
const DAY_MS = 86_400_000;

export interface NoticeForMatch {
  accountId: string;
  balance: number;
  noticeAt: Date;
}

export interface BankLineForMatch {
  id: string;
  date: Date;
  amount: number;
  description: string;
}

export interface NoticeBankMatch {
  lineId: string;
  date: string;
  amount: number;
  description: string;
  by: 'txid' | 'amount';
}

const cents = (n: number) => Math.round(n * 100);
const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** txid do Pix estático = id da conta só com alfanuméricos, até 25 caracteres (ver lib/pix.ts). */
export function noticeTxid(accountId: string): string {
  return alnum(accountId).slice(0, 25);
}

export function matchNoticesToBank(notices: NoticeForMatch[], lines: BankLineForMatch[]): Map<string, NoticeBankMatch> {
  const credits = lines.filter((l) => l.amount > 0);
  const out = new Map<string, NoticeBankMatch>();
  const used = new Set<string>();
  const toMatch = (l: BankLineForMatch, by: NoticeBankMatch['by']): NoticeBankMatch => ({
    lineId: l.id, date: l.date.toISOString(), amount: l.amount, description: l.description, by,
  });

  // 1) Identificador do Pix na descrição: certeiro.
  for (const n of notices) {
    const txid = noticeTxid(n.accountId);
    if (txid.length < 8) continue;
    const hit = credits.find((l) => !used.has(l.id) && alnum(l.description).includes(txid));
    if (hit) { out.set(n.accountId, toMatch(hit, 'txid')); used.add(hit.id); }
  }

  // 2) Mesmo valor perto da data do aviso — só sem ambiguidade dos dois lados.
  const near = (n: NoticeForMatch, l: BankLineForMatch) =>
    cents(l.amount) === cents(n.balance) && Math.abs(l.date.getTime() - n.noticeAt.getTime()) <= NOTICE_MATCH_DAYS * DAY_MS;
  const pending = notices.filter((n) => !out.has(n.accountId));
  for (const n of pending) {
    const options = credits.filter((l) => !used.has(l.id) && near(n, l));
    if (options.length !== 1) continue;
    const line = options[0];
    const rivals = pending.filter((o) => o.accountId !== n.accountId && !out.has(o.accountId) && near(o, line));
    if (rivals.length > 0) continue;
    out.set(n.accountId, toMatch(line, 'amount'));
    used.add(line.id);
  }
  return out;
}
