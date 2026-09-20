// Planejador da importação de backup financeiro de um sistema legado.
//
// Recebe os relatórios já lidos (reports.ts / realign.ts) e monta um PLANO
// completo — o que seria criado, com as conferências de totais — sem tocar no
// banco. A tela mostra o plano; só depois de confirmado o commit.ts grava.
//
// Ideia central: o Extrato diz ONDE o dinheiro entrou/saiu (conta) e para quem;
// o Razão diz a CATEGORIA de cada lançamento (inclusive os "(Dividido)", que no
// extrato vêm sem categoria). Os dois se casam 1:1 por (data, valor) — a
// conferência exige que todos casem. O Balancete vira um balancete arquivado
// (com o detalhe por conta) e as Contas a Pagar/Receber viram títulos em aberto.

import type { BalanceteLine, BalanceteParsed, ExtratoEntry, ExtratoParsed, LedgerEntry, RazaoParsed } from './reports';
import type { CounterpartiesParsed, CounterpartyRow, OpenItemsParsed } from './realign';
import { categoryKeyFromPath, hasTableRule, suggestByName, suggestFromTable } from './mapping';
import { normalizeName, round2 } from './values';

export interface LegacyFiles {
  extrato?: ExtratoParsed;
  razao?: RazaoParsed;
  balancete?: BalanceteParsed;
  clients?: CounterpartiesParsed;
  suppliers?: CounterpartiesParsed;
  openItems?: OpenItemsParsed;
}

export interface PlanOptions {
  /** none: nunca liga a membro · exact: nome idêntico · fuzzy: também nome abreviado/truncado (conferir!). */
  memberMatching: 'none' | 'exact' | 'fuzzy';
  /** Categoria do legado ("Grupo:Folha") → código do plano de contas (ou null = sem categoria). */
  categoryOverrides: Record<string, string | null>;
  /** "<Abertura de Saldo>" vira saldo inicial da conta em vez de receita do período. */
  openingEntriesAsOpeningBalance: boolean;
  includeOpenItems: boolean;
}

export const DEFAULT_PLAN_OPTIONS: PlanOptions = {
  memberMatching: 'exact',
  categoryOverrides: {},
  openingEntriesAsOpeningBalance: true,
  includeOpenItems: true,
};

export interface PlanContext {
  chart: { code: string; name: string; type: string }[];
  members: { id: string; name: string }[];
  financialAccounts: { id: string; name: string }[];
}

export interface PlanFinancialAccount {
  name: string;
  kind: 'bank' | 'cash';
  bankName: string | null;
  isInvestment: boolean;
  openingBalance: number;
  existingId: string | null;
}

export interface PlanPartyRef {
  memberId: string | null;
  counterpartyKey: string | null; // chave normalizada em PlanCounterparty
  name: string;
}

export interface PlanTransaction extends PlanPartyRef {
  account: string;
  date: string;
  amount: number; // sempre positivo
  type: 'RECEIVABLE' | 'PAYABLE';
  title: string;
  description: string;
  categoryKey: string | null; // "Financeiro:Mensalidade" (legado)
  chartCode: string | null;
  isDues: boolean;
}

export interface PlanTransfer {
  from: string;
  to: string;
  amount: number;
  date: string;
  note: string;
}

export interface PlanOpenItem extends PlanPartyRef {
  dueDate: string;
  amount: number;
  type: 'RECEIVABLE' | 'PAYABLE';
  title: string;
  description: string;
  chartCode: string | null;
  isDues: boolean;
}

export interface PlanCounterparty {
  key: string;
  name: string;
  kind: 'client' | 'supplier' | 'both';
  isCompany: boolean;
  document: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
}

export interface PlanCategory {
  key: string;
  count: number;
  total: number; // soma assinada
  suggestedCode: string | null;
  how: 'table' | 'rule' | 'name' | 'none';
  chosenCode: string | null;
}

export interface PlanCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface PlanBalancete {
  periodFrom: string;
  periodTo: string;
  totalReceivables: number;
  totalPayables: number;
  totalPayments: number;
  netBalance: number;
  lines: BalanceteLine[];
  notes: string;
}

export interface ImportPlan {
  financialAccounts: PlanFinancialAccount[];
  transactions: PlanTransaction[];
  transfers: PlanTransfer[];
  openItems: PlanOpenItem[];
  counterparties: PlanCounterparty[];
  balancete: PlanBalancete | null;
  categories: PlanCategory[];
  checks: PlanCheck[];
  warnings: string[];
  summary: {
    transactions: number;
    receipts: number;
    payments: number;
    transfers: number;
    openItems: number;
    openItemsTotal: number;
    counterparties: number;
    withoutCategory: number;
    withoutCategoryTotal: number;
    memberLinks: number;
  };
}

const INTERNAL_LABELS = new Set(['TRONCO DE SOLIDARIEDADE', 'RENDIMENTO E RESGATES', 'VENDEDOR PADRAO', '']);
const BRACKET = /^\[(Para|De):\s*(.+?)\]?\s*$/i;
const KNOWN_BANKS = ['Santander', 'Banco do Brasil', 'Itaú Unibanco', 'Bradesco', 'Caixa Econômica Federal', 'Nubank', 'Banco Inter', 'C6 Bank', 'Sicoob', 'Sicredi'];

const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0));

function fuzzyMember(favNorm: string, members: { id: string; name: string; norm: string; tokens: string[] }[]) {
  const favTokens = favNorm.split(' ').filter((t) => t.length >= 3);
  if (favTokens.length < 2) return null;
  let best: (typeof members)[number] | null = null;
  let bestScore = 0;
  for (const m of members) {
    let hits = 0;
    for (const ft of favTokens) if (m.tokens.some((mt) => mt.startsWith(ft) || ft.startsWith(mt))) hits++;
    const score = hits / favTokens.length;
    if (score > bestScore && score >= 0.75) { bestScore = score; best = m; }
  }
  return best;
}

export function buildPlan(files: LegacyFiles, ctx: PlanContext, opts: PlanOptions = DEFAULT_PLAN_OPTIONS): ImportPlan {
  const warnings: string[] = [];
  const checks: PlanCheck[] = [];
  const chartByCode = new Map(ctx.chart.map((c) => [c.code, c]));
  const memberIndex = ctx.members.map((m) => ({ ...m, norm: normalizeName(m.name), tokens: normalizeName(m.name).split(' ').filter((t) => t.length >= 3) }));
  const memberByNorm = new Map(memberIndex.map((m) => [m.norm, m]));

  // ---------- cadastro de clientes/fornecedores (base das contrapartes) ----------
  const registry = new Map<string, { row: CounterpartyRow; kind: 'client' | 'supplier' }>();
  for (const [parsed, kind] of [[files.clients, 'client'], [files.suppliers, 'supplier']] as const) {
    if (!parsed) continue;
    for (const row of parsed.rows) {
      const key = normalizeName(row.name);
      if (INTERNAL_LABELS.has(key)) continue;
      if (!registry.has(key)) registry.set(key, { row, kind });
    }
    for (const issue of parsed.issues) warnings.push(`Cadastro de ${kind === 'client' ? 'clientes' : 'fornecedores'}: ${issue}`);
    checks.push({
      label: `Cadastro de ${kind === 'client' ? 'clientes' : 'fornecedores'}`,
      ok: parsed.declaredCount == null || parsed.rows.length + parsed.merged.length === parsed.declaredCount,
      detail: `${parsed.rows.length} cadastro(s) lido(s)${parsed.declaredCount != null ? ` de ${parsed.declaredCount} declarados` : ''}${parsed.merged.length ? `; ${parsed.merged.length} repetido(s) unificado(s)` : ''}.`,
    });
  }

  const partyFlags = new Map<string, { client: boolean; supplier: boolean; name: string }>();
  const touchParty = (name: string, isCredit: boolean) => {
    const key = normalizeName(name);
    const f = partyFlags.get(key) ?? { client: false, supplier: false, name: name.trim() };
    if (isCredit) f.client = true; else f.supplier = true;
    partyFlags.set(key, f);
  };
  let memberLinks = 0;
  const resolveParty = (rawName: string, isCredit: boolean): PlanPartyRef => {
    const name = rawName.trim();
    const key = normalizeName(name);
    if (!name || INTERNAL_LABELS.has(key)) return { memberId: null, counterpartyKey: null, name: '' };
    if (opts.memberMatching !== 'none') {
      const exact = memberByNorm.get(key);
      const hit = exact ?? (opts.memberMatching === 'fuzzy' ? fuzzyMember(key, memberIndex) : null);
      if (hit) { memberLinks++; return { memberId: hit.id, counterpartyKey: null, name }; }
    }
    touchParty(name, isCredit);
    return { memberId: null, counterpartyKey: key, name };
  };

  // ---------- categorias: sugestão para uma chave do legado ----------
  const categoryStats = new Map<string, PlanCategory>();
  const codeFor = (key: string | null, isCredit: boolean, fav: string): string | null => {
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(opts.categoryOverrides, key)) return opts.categoryOverrides[key];
    const s = suggestFromTable(key, isCredit, fav);
    return hasTableRule(key) ? s.code : suggestByName(key, isCredit, ctx.chart).code;
  };
  const noteCategory = (key: string | null, isCredit: boolean, fav: string, valor: number) => {
    if (!key) return;
    let c = categoryStats.get(key);
    if (!c) {
      const s = hasTableRule(key) ? suggestFromTable(key, isCredit, fav) : suggestByName(key, isCredit, ctx.chart);
      c = { key, count: 0, total: 0, suggestedCode: s.code, how: s.how, chosenCode: null };
      categoryStats.set(key, c);
    }
    c.count++;
    c.total = round2(c.total + valor);
  };

  // ---------- extrato + razão ----------
  const plan: ImportPlan = {
    financialAccounts: [], transactions: [], transfers: [], openItems: [], counterparties: [], balancete: null,
    categories: [], checks, warnings,
    summary: { transactions: 0, receipts: 0, payments: 0, transfers: 0, openItems: 0, openItemsTotal: 0, counterparties: 0, withoutCategory: 0, withoutCategoryTotal: 0, memberLinks: 0 },
  };

  const ex = files.extrato;
  if (ex) {
    const entries = ex.entries;
    const declared = ex.declaredTotals;
    if (declared.count != null) checks.push({ label: 'Extrato: nº de lançamentos', ok: entries.length === declared.count, detail: `${entries.length} lidos · ${declared.count} declarados no relatório.` });
    if (declared.finalBalance != null) {
      const total = sum(entries.map((e) => e.valor)) + sum(ex.accounts.map((a) => a.openingBalance));
      checks.push({ label: 'Extrato: saldo final', ok: Math.abs(total - declared.finalBalance) < 0.005, detail: `${round2(total).toFixed(2)} calculado · ${declared.finalBalance.toFixed(2)} declarado.` });
    }
    for (const a of ex.accounts) {
      const own = entries.filter((e) => e.account === a.name);
      if (a.declaredCount != null) checks.push({ label: `Conta ${a.name}: lançamentos`, ok: own.length === a.declaredCount, detail: `${own.length} lidos · ${a.declaredCount} declarados.` });
      const last = [...own].reverse().find((e) => e.saldo != null);
      if (last) {
        const calc = round2(a.openingBalance + sum(own.map((e) => e.valor)));
        checks.push({ label: `Conta ${a.name}: saldo corrente`, ok: Math.abs(calc - last.saldo!) < 0.005, detail: `${calc.toFixed(2)} calculado · ${last.saldo!.toFixed(2)} no último lançamento.` });
      }
    }

    // --- transferências entre contas próprias: pareia "[Para: X]" com "[De: Y]" ---
    const used = new Set<number>();
    const transfers: PlanTransfer[] = [];
    entries.forEach((e, i) => {
      const m = e.favorecido.match(BRACKET);
      if (!m || m[1].toLowerCase() !== 'para' || e.valor >= 0 || used.has(i)) return;
      const target = normalizeName(m[2]);
      const j = entries.findIndex((o, k) => k !== i && !used.has(k) && o.valor > 0 && o.date === e.date && Math.abs(o.valor + e.valor) < 0.005
        && normalizeName(o.account) === target && BRACKET.test(o.favorecido) && normalizeName(o.favorecido.match(BRACKET)![2]) === normalizeName(e.account));
      if (j < 0) return;
      used.add(i); used.add(j);
      transfers.push({ from: e.account, to: entries[j].account, amount: Math.abs(e.valor), date: e.date, note: 'Transferência importada do sistema anterior' });
    });
    plan.transfers = transfers;

    // --- casa o razão com o extrato por (data, valor) para descobrir a categoria ---
    const razaoPool = new Map<string, LedgerEntry[]>();
    for (const r of files.razao?.entries ?? []) {
      const k = `${r.date}|${r.valor.toFixed(2)}`;
      razaoPool.set(k, [...(razaoPool.get(k) ?? []), r]);
    }
    const plainPlano = (p: string) => p.trim();
    let razaoMatched = 0;
    let razaoMissing = 0;

    type Real = { e: ExtratoEntry; razao: LedgerEntry | null };
    const reals: Real[] = [];
    entries.forEach((e, i) => {
      if (used.has(i)) return;
      if (files.razao) {
        const k = `${e.date}|${e.valor.toFixed(2)}`;
        const cands = razaoPool.get(k) ?? [];
        // prefere o candidato que já tem a mesma categoria do extrato; senão o primeiro
        let idx = cands.findIndex((c) => categoryKeyFromPath(c.path) === plainPlano(e.planoConta));
        if (idx < 0) idx = cands.findIndex((c) => c.path.length > 0);
        if (idx < 0) idx = 0;
        const hit = cands[idx];
        if (hit) { cands.splice(idx, 1); razaoMatched++; reals.push({ e, razao: hit }); return; }
        razaoMissing++;
      }
      reals.push({ e, razao: null });
    });
    if (files.razao) {
      const left = [...razaoPool.values()].flat();
      checks.push({
        label: 'Razão × extrato',
        ok: razaoMissing === 0 && left.length <= 1,
        detail: `${razaoMatched} lançamento(s) do extrato casaram com o razão; ${razaoMissing} sem par no razão; ${left.length} do razão sem par no extrato.`,
      });
      if (files.razao.total != null && declared.finalBalance != null) {
        checks.push({ label: 'Razão: soma dos lançamentos', ok: Math.abs(files.razao.total - declared.finalBalance) < 0.005, detail: `${files.razao.total.toFixed(2)} no razão · ${declared.finalBalance.toFixed(2)} no extrato.` });
      }
      for (const l of left) warnings.push(`Razão sem par no extrato: ${l.date} ${l.valor.toFixed(2)} ${l.history} (${l.path.join(' › ') || 'sem categoria'}).`);
    }

    // --- saldos de abertura + contas financeiras ---
    const opening = new Map<string, number>(ex.accounts.map((a) => [a.name, a.openingBalance]));
    const real2: Real[] = [];
    for (const r of reals) {
      const isOpeningEntry = opts.openingEntriesAsOpeningBalance && r.e.valor > 0
        && /^ABERTURA DE SALDO$/.test(normalizeName(r.razao?.history ?? ''));
      if (isOpeningEntry) {
        opening.set(r.e.account, round2((opening.get(r.e.account) ?? 0) + r.e.valor));
        warnings.push(`"<Abertura de Saldo>" de ${r.e.valor.toFixed(2)} em ${r.e.date} (${r.e.account}) virou saldo inicial da conta, não receita.`);
      } else real2.push(r);
    }

    for (const a of ex.accounts) {
      const isCash = /^caixa$/i.test(a.name.trim());
      const existing = ctx.financialAccounts.find((f) => normalizeName(f.name) === normalizeName(a.name));
      plan.financialAccounts.push({
        name: a.name,
        kind: isCash ? 'cash' : 'bank',
        bankName: isCash ? null : (KNOWN_BANKS.find((b) => normalizeName(a.name).startsWith(normalizeName(b))) ?? null),
        isInvestment: /investimento|aplica[cç][aã]o|cdb/i.test(a.name),
        openingBalance: opening.get(a.name) ?? 0,
        existingId: existing?.id ?? null,
      });
    }

    // --- lançamentos ---
    for (const { e, razao } of real2) {
      const isCredit = e.valor > 0;
      const legacyPlano = plainPlano(e.planoConta);
      // categoria: a do razão (quando existe e está definida); senão a do extrato, exceto "(Dividido)"
      let key = razao && razao.path.length > 0 ? categoryKeyFromPath(razao.path) : null;
      if (!key && legacyPlano && !/^\(Dividido\)$/i.test(legacyPlano)) key = legacyPlano;
      // Não classificado mas de/para o Tronco: mesma regra do legado.
      let code = codeFor(key, isCredit, e.favorecido);
      // Sem categoria, mas o favorecido é um rótulo interno que já diz o que é (mesma regra que o
      // legado usava nas 29 doações ao Tronco que vieram etiquetadas).
      if (!key) {
        const fav = normalizeName(e.favorecido);
        if (fav === 'TRONCO DE SOLIDARIEDADE') code = '1.1.05';
        else if (fav === 'RENDIMENTO E RESGATES' && isCredit) code = '1.2.01';
        else if (fav === 'TARIFA BANCARIA' && !isCredit) code = '2.1.06';
      }
      if (code && !chartByCode.has(code)) {
        warnings.push(`Categoria ${code} não existe no plano de contas da loja (lançamento de ${e.date}, ${Math.abs(e.valor).toFixed(2)}).`);
        code = null;
      }
      noteCategory(key, isCredit, e.favorecido, e.valor);

      const party = resolveParty(e.favorecido, isCredit);
      const chart = code ? chartByCode.get(code) : null;
      const history = razao?.history?.trim() ?? '';
      plan.transactions.push({
        ...party,
        account: e.account,
        date: e.date,
        amount: Math.abs(e.valor),
        type: isCredit ? 'RECEIVABLE' : 'PAYABLE',
        title: chart?.name ?? (history || e.favorecido.trim() || legacyPlano || 'Lançamento importado'),
        description: [key ? `Categoria no sistema anterior: ${key}` : 'Sem categoria no sistema anterior', e.account, e.numero ? `nº ${e.numero}` : '', history && history !== e.favorecido.trim() ? history : '']
          .filter(Boolean).join(' | '),
        categoryKey: key,
        chartCode: code,
        isDues: !!chart && chart.code === '1.1.01' && !!party.memberId,
      });
    }
  }

  // ---------- contas a pagar/receber em aberto ----------
  if (files.openItems && opts.includeOpenItems) {
    const oi = files.openItems;
    for (const issue of oi.issues) warnings.push(`Contas em aberto: ${issue}`);
    const mensalidade = chartByCode.get('1.1.01');
    for (const it of oi.items) {
      const isCredit = it.kind === 'receivable';
      const party = resolveParty(it.name, isCredit);
      // Sem o plano de conta no relatório, só o que é a receber de pessoa é tratado como mensalidade.
      const chart = isCredit ? mensalidade : null;
      plan.openItems.push({
        ...party,
        dueDate: it.dueDate,
        amount: it.amount,
        type: isCredit ? 'RECEIVABLE' : 'PAYABLE',
        title: chart?.name ?? 'Conta em aberto importada',
        description: `Em aberto no sistema anterior em ${oi.referenceDate ?? 'data desconhecida'}${it.daysOverdue != null ? ` (vencido há ${it.daysOverdue} dia(s))` : ''}`,
        chartCode: chart?.code ?? null,
        isDues: !!chart && !!party.memberId,
      });
    }
    checks.push({
      label: 'Contas em aberto',
      ok: oi.issues.length === 0,
      detail: `${oi.items.length} título(s) · R$ ${sum(oi.items.map((i) => i.amount)).toFixed(2)}${oi.declared.in != null ? ` (declarado: ${oi.declared.in.toFixed(2)})` : ''}.`,
    });
  }

  // ---------- contrapartes (clientes/fornecedores) ----------
  const cps = new Map<string, PlanCounterparty>();
  const memberNorms = new Set(memberIndex.map((m) => m.norm));
  for (const [key, { row, kind }] of registry) {
    if (opts.memberMatching !== 'none' && memberNorms.has(key)) continue; // é membro: não vira cliente
    const flags = partyFlags.get(key);
    const both = flags ? (kind === 'client' ? flags.supplier : flags.client) : false;
    cps.set(key, {
      key, name: row.name, kind: both ? 'both' : kind, isCompany: row.isCompany, document: row.document, phone: row.phone, city: row.city, state: row.state,
      notes: row.invalidDocument ? `Documento informado no sistema anterior (dígito verificador inválido): ${row.invalidDocument}` : null,
    });
  }
  for (const [key, f] of partyFlags) {
    if (cps.has(key)) continue;
    cps.set(key, { key, name: f.name, kind: f.client && f.supplier ? 'both' : f.client ? 'client' : 'supplier', isCompany: false, document: null, phone: null, city: null, state: null, notes: null });
  }
  // documento único por loja: o 2º cadastro com o mesmo documento fica sem ele
  const docSeen = new Set<string>();
  for (const c of cps.values()) {
    if (!c.document) continue;
    if (docSeen.has(c.document)) { warnings.push(`Documento ${c.document} repetido: "${c.name}" ficou sem documento.`); c.document = null; } else docSeen.add(c.document);
  }
  plan.counterparties = [...cps.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  // ---------- balancete ----------
  const bal = files.balancete;
  if (bal && bal.periodFrom && bal.periodTo) {
    for (const issue of bal.issues) warnings.push(`Balancete: ${issue}`);
    const d = bal.declared;
    const debit = d.debit ?? sum(bal.lines.filter((l) => l.level === 0).map((l) => l.debit));
    const credit = d.credit ?? sum(bal.lines.filter((l) => l.level === 0).map((l) => l.credit));
    const closing = d.closing ?? round2((d.opening ?? 0) + debit + credit);
    if (ex?.declaredTotals.finalBalance != null) {
      checks.push({ label: 'Balancete × extrato: saldo final', ok: Math.abs(closing - ex.declaredTotals.finalBalance) < 0.005, detail: `${closing.toFixed(2)} no balancete · ${ex.declaredTotals.finalBalance.toFixed(2)} no extrato.` });
    }
    plan.balancete = {
      periodFrom: bal.periodFrom,
      periodTo: bal.periodTo,
      totalReceivables: credit,
      totalPayables: Math.abs(debit),
      totalPayments: credit,
      netBalance: closing,
      lines: bal.lines,
      notes: `Balancete importado do sistema anterior${bal.lodgeName ? ` (${bal.lodgeName})` : ''}, exercício ${bal.exercise ?? bal.periodFrom.slice(0, 4)}. Detalhe por conta preservado.`,
    };
  }

  // ---------- fecha categorias e resumo ----------
  plan.categories = [...categoryStats.values()]
    .map((c) => ({ ...c, chosenCode: Object.prototype.hasOwnProperty.call(opts.categoryOverrides, c.key) ? opts.categoryOverrides[c.key] : c.suggestedCode }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  const uncategorized = plan.transactions.filter((t) => !t.chartCode);
  plan.summary = {
    transactions: plan.transactions.length,
    receipts: plan.transactions.filter((t) => t.type === 'RECEIVABLE').length,
    payments: plan.transactions.filter((t) => t.type === 'PAYABLE').length,
    transfers: plan.transfers.length,
    openItems: plan.openItems.length,
    openItemsTotal: sum(plan.openItems.map((i) => (i.type === 'RECEIVABLE' ? i.amount : -i.amount))),
    counterparties: plan.counterparties.length,
    withoutCategory: uncategorized.length,
    withoutCategoryTotal: sum(uncategorized.map((t) => (t.type === 'RECEIVABLE' ? t.amount : -t.amount))),
    memberLinks,
  };
  return plan;
}
