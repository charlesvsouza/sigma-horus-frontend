// Painel rápido do irmão (navegação rápida): regras puras — o que cada cargo pode ver e como se monta o financeiro.
// Princípio do dono: cada cargo na sua área. O painel NÃO amplia permissão: contato exige leitura de Membros,
// financeiro exige leitura de Contas E ser Tesoureiro, Venerável ou Administrador (os cargos que têm as telas de
// Contas no menu; o Hospitaleiro lê Contas só por causa do Tronco e não ganha o financeiro de ninguém). Secretário não vê
// dinheiro; quem não tem nenhuma das duas não abre o painel.

export interface QuickAccess { contact: boolean; financial: boolean }

export const QUICK_FINANCE_ROLES = ['admin', 'venerable', 'treasurer'];

export function quickAccess(canReadMembers: boolean, canReadAccounts: boolean, role: string | null | undefined): QuickAccess | null {
  const financial = canReadAccounts && QUICK_FINANCE_ROLES.includes((role ?? '').toLowerCase().trim());
  if (!canReadMembers && !financial) return null;
  return { contact: canReadMembers, financial };
}

export interface QuickAccountInput {
  id: string;
  title: string;
  type: string; // RECEIVABLE | PAYABLE
  amount: number;
  dueDate: Date;
  status: string;
  payments: { amount: number }[];
}

export interface QuickPending { id: string; title: string; dueDate: string; balance: number; overdue: boolean; daysOverdue: number }
export interface QuickFinancial { debt: number; overdue: number; credit: number; pending: QuickPending[] }

const cents = (n: number) => Math.round(n * 100);
const DAY_MS = 86_400_000;

/** Saldo devedor, vencido, crédito (a loja deve ao irmão) e a lista de pendências (do mais antigo ao mais novo). `today` = dia civil de Brasília (00:00 UTC). */
export function buildFinancial(accounts: QuickAccountInput[], today: Date): QuickFinancial {
  let debt = 0, overdue = 0, credit = 0;
  const pending: QuickPending[] = [];
  for (const a of accounts) {
    if (a.status === 'paid') continue;
    const paid = a.payments.reduce((s, p) => s + cents(p.amount), 0);
    const balance = Math.max(0, cents(a.amount) - paid);
    if (balance === 0) continue;
    if (a.type === 'PAYABLE') { credit += balance; continue; }
    const due = Date.UTC(a.dueDate.getUTCFullYear(), a.dueDate.getUTCMonth(), a.dueDate.getUTCDate());
    const days = Math.max(0, Math.floor((today.getTime() - due) / DAY_MS));
    debt += balance;
    if (days > 0) overdue += balance;
    pending.push({ id: a.id, title: a.title, dueDate: new Date(due).toISOString(), balance: balance / 100, overdue: days > 0, daysOverdue: days });
  }
  pending.sort((x, y) => x.dueDate.localeCompare(y.dueDate));
  return { debt: debt / 100, overdue: overdue / 100, credit: credit / 100, pending };
}
