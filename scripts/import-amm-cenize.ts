/**
 * Migração do histórico financeiro da Loja Antônio Monteiro Martins (amm139)
 * a partir do backup do sistema legado Cenize/Loje — SÓ POR LINHA DE COMANDO.
 *
 * Fonte: "EXTRATO ATÉ 1409.csv" (extrato de Caixa/Santander/Santander
 * Investimento), export de relatório de impressão em ISO-8859-1, colunas que
 * mudam de posição entre páginas — por isso o parser abaixo re-detecta os
 * índices a cada cabeçalho em vez de usar posições fixas. Totais batidos a
 * centavo contra os "Resumo" do próprio arquivo (ver conversa de migração).
 *
 * Escopo desta leva: só o extrato de caixa (918 lançamentos já realizados).
 * NÃO inclui (fica para uma 2ª leva, documentada e não perdida):
 *   - Contas a Pagar e Receber por Vencimento (títulos em aberto, ainda não
 *     pagos) — parsing do PDF tem o mesmo problema de colunas cambiantes,
 *     não resolvido ainda.
 *   - CPF/CNPJ de CLIENTES.pdf/FORNECEDORES.pdf para enriquecer counterpartyDoc.
 *
 * Cada linha do extrato vira 3 registros: Account (já "paid", isDues=true
 * quando é mensalidade), Payment (baixa), BankTransaction (status=matched,
 * linkada ao Payment). Transferências entre contas da própria loja
 * ([Para: X]/[De: X], categoria "Transferência") não geram Account/Payment —
 * só BankTransaction com status=ignored (não é receita nem despesa real).
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/import-amm-cenize.ts <extrato.csv>
 *
 * Depois de conferir o relatório de divergências, para gravar de verdade:
 *   node --env-file=.env --import ./test/setup.mjs scripts/import-amm-cenize.ts <extrato.csv> \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { prismaAdmin } from '../src/lib/prisma';

const LODGE_ID = 'cmte81osx000104l1d7cfhg5y'; // amm139
const IMPORT_TAG = 'import:cenize:amm139:v1';

// ---------- parsing (extrato Cenize) ----------

interface ParsedTxn {
  account: string; // Caixa | Santander | Santander Investimento
  date: string; // YYYY-MM-DD
  favorecido: string;
  planoConta: string;
  numero: string;
  valor: number; // já assinado (crédito +, débito -)
  saldo: number | null;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (const c of line) {
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ';' && !inQuotes) { cells.push(cur); cur = ''; }
    else cur += c;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function parseBrNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (!s) return null;
  const negParen = /^\(.*\)$/.test(s);
  s = s.replace(/[^\d,.-]/g, '');
  if (!s) return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  let n = Number(normalized);
  if (Number.isNaN(n)) return null;
  if (negParen) n = -Math.abs(n);
  return n;
}

function parseBrDate(raw: string | undefined): string | null {
  const m = raw && raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseExtrato(filePath: string): ParsedTxn[] {
  const text = readFileSync(filePath).toString('latin1');
  const lines = text.split(/\r?\n/);

  let colMap: { date: number; numero: number; favorecido: number; planoConta: number; valor: number; saldo: number } | null = null;
  let currentAccount: string | null = null;
  const out: ParsedTxn[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    const nonEmptyIdx = cells.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
    if (nonEmptyIdx.length === 0) continue;

    if (cells.includes('Data') && (cells.includes('Valor') || cells.includes('Saldo'))) {
      colMap = {
        date: cells.indexOf('Data'),
        numero: cells.indexOf('Número'),
        favorecido: cells.indexOf('Favorecido/Pagador'),
        planoConta: cells.indexOf('Plano de Conta'),
        valor: cells.indexOf('Valor'),
        saldo: cells.indexOf('Saldo'),
      };
      continue;
    }

    const contaIdx = cells.indexOf('Conta:');
    if (contaIdx >= 0) {
      const nameIdx = nonEmptyIdx.find((i) => i > contaIdx);
      currentAccount = nameIdx != null ? cells[nameIdx] : null;
      continue;
    }

    if (cells.includes('Resumo') || cells.some((c) => c.startsWith('Total lan'))) continue;
    if (!colMap || !currentAccount) continue;

    const date = parseBrDate(cells[colMap.date]);
    if (!date) continue; // linha de continuação (histórico livre) — ignorada nesta leva

    const valor = parseBrNumber(cells[colMap.valor]);
    if (valor == null) continue;

    let cd = '';
    for (let i = colMap.saldo + 1; i < cells.length; i++) {
      if (cells[i] === 'C' || cells[i] === 'D') { cd = cells[i]; break; }
    }
    const signedAmount = cd === 'D' ? -Math.abs(valor) : Math.abs(valor);

    out.push({
      account: currentAccount,
      date,
      favorecido: cells[colMap.favorecido] ?? '',
      planoConta: cells[colMap.planoConta] ?? '',
      numero: cells[colMap.numero] ?? '',
      valor: signedAmount,
      saldo: colMap.saldo >= 0 ? parseBrNumber(cells[colMap.saldo]) : null,
    });
  }
  return out;
}

// ---------- mapeamento de categorias (Cenize -> ChartAccount.code) ----------
// função de (planoConta, crédito?) porque algumas categorias da Cenize
// cobrem tanto receita quanto despesa dependendo do sinal do lançamento.
function mapChartAccountCode(planoConta: string, isCredit: boolean, favorecido: string): string | null {
  const p = planoConta.trim();
  // "Financeiro:Cobrança" é quase todo boleto pago à Grande Loja (97,7% do
  // valor, ver dry-run) — os poucos restantes (RCPJ, alguns membros) ficam
  // sem mapeamento automático por serem heterogêneos e de baixo valor.
  if (p === 'Financeiro:Cobrança') return favorecido.trim().toUpperCase() === 'GRANDE LOJA' ? '2.1.15' : null;
  // Linhas sem categoria mas com favorecido "TRONCO DE SOLIDARIEDADE" são o
  // mesmo tipo de doação das 29 já tagueadas como Financeiro:Tronco de
  // Solidariedade — só ficaram sem o rótulo no export.
  if (!p && favorecido.trim().toUpperCase() === 'TRONCO DE SOLIDARIEDADE') return '1.1.05';
  // "Financeiro:Depósito": 16 lançamentos, todos crédito, valores de membros
  // (inclusive de outra loja) — contribuições avulsas, não mensalidade.
  if (p === 'Financeiro:Depósito' && isCredit) return '1.1.04';
  const table: Record<string, string | ((c: boolean) => string | null)> = {
    'Financeiro:Mensalidade': '1.1.01',
    'Financeiro:Tronco de Solidariedade': '1.1.05',
    'Financeiro:Exaltação/Elevação/Iniciação': '1.1.02',
    'Financeiro:Filiação': '1.1.03',
    'Financeiro:Tarifa Bancária': '2.1.06',
    'Financeiro:Contabilidade': '2.1.07',
    'Financeiro:Compra de Ritual': '8.9.06',
    'Investimentos:Ganhos de Capital': '1.2.01',
    'Comercial:Compra Camisa Maçonaria': (c) => (c ? '1.2.04' : '8.9.06'),
    'Comercial:Divisão Festa Fim de Ano': (c) => (c ? '1.5.05' : '2.1.11'),
    'Comercial:Divisão Agape': (c) => (c ? '1.5.05' : '2.1.11'),
    'Eventos:Buffet': '2.1.11',
    'Eventos:Aluguel': '2.1.11',
    'Eventos:Bebidas': '2.1.11',
    'Eventos:Musical': '2.1.11',
    'Eventos:Gelo': '2.1.11',
    'Eventos:Diária Churrasqueiro': '2.1.11',
    'AMORIO:Aluguel': '2.1.05',
    'AMORIO:Area gourmet': '2.1.05',
    'Suprimentos:Compra Mercadorias Refeição': '2.1.11',
    'Suprimentos:Despensa': '2.1.14',
    'Suprimentos:Material de Limpeza/Higiene': '2.1.14',
    'Suprimentos:Impressora/Fax': '2.1.04',
    'Financeiro:Reembolso': (c) => (c ? '1.2.05' : null),
  };
  const entry = table[p];
  if (entry == null) return null;
  return typeof entry === 'function' ? entry(isCredit) : entry;
}

// categorias/favorecidos que não são contraparte real (rótulo interno do
// relatório, não uma pessoa/empresa) — não vira counterpartyName.
const INTERNAL_LABELS = new Set([
  'TRONCO DE SOLIDARIEDADE', 'RENDIMENTO E RESGATES', 'VENDEDOR PADRAO', '',
]);
const TRANSFER_PLANO_CONTA = new Set(['Transferência', 'Financeiro:Transferência']);

function isTransferFavorecido(fav: string): boolean {
  return /^\[(Para|De):/i.test(fav.trim());
}

function normalizeName(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// casamento fuzzy simples: todo token do favorecido (>=3 letras) aparece como
// prefixo de algum token do nome do membro, ou vice-versa — cobre truncamento
// ("MAXWELL MAGALHAES PAIXAO DA" -> "...DA CONCEICAO") e abreviação de nome do meio.
function fuzzyMemberMatch(favNorm: string, members: { id: string; name: string }[]): { id: string; name: string } | null {
  const favTokens = favNorm.split(' ').filter((t) => t.length >= 3);
  if (favTokens.length < 2) return null;
  let best: { id: string; name: string } | null = null;
  let bestScore = 0;
  for (const m of members) {
    const memTokens = normalizeName(m.name).split(' ').filter((t) => t.length >= 3);
    let hits = 0;
    for (const ft of favTokens) {
      if (memTokens.some((mt) => mt.startsWith(ft) || ft.startsWith(mt))) hits++;
    }
    const score = hits / favTokens.length;
    if (score > bestScore && score >= 0.75) { bestScore = score; best = m; }
  }
  return best;
}

async function main() {
  const argv = process.argv;
  const csvPath = argv[2];
  const yes = argv.includes('--yes');
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;

  if (!csvPath) {
    console.error('Uso: import-amm-cenize.ts <EXTRATO.csv> [--confirm-host <trecho>] [--yes]');
    process.exitCode = 1;
    return;
  }

  const txns = parseExtrato(csvPath);
  console.log(`Lançamentos parseados: ${txns.length}`);

  const members = await prismaAdmin.member.findMany({ where: { lodgeId: LODGE_ID }, select: { id: true, name: true } });
  const chartAccounts = await prismaAdmin.chartAccount.findMany({ where: { lodgeId: LODGE_ID }, select: { id: true, code: true, type: true } });
  const chartByCode = new Map(chartAccounts.map((c) => [c.code, c]));
  const memberByNorm = new Map(members.map((m) => [normalizeName(m.name), m]));

  const existing = await prismaAdmin.account.count({ where: { lodgeId: LODGE_ID, description: { contains: IMPORT_TAG } } });
  if (existing > 0 && !yes) {
    console.log(`\n[AVISO] Já existem ${existing} Account(s) desta importação (tag "${IMPORT_TAG}"). Rodar de novo com --yes vai duplicar. Revise antes.`);
  }

  type Plan = {
    txn: ParsedTxn;
    isTransfer: boolean;
    memberId: string | null;
    memberMatchType: 'exact' | 'fuzzy' | null;
    counterpartyName: string | null;
    chartAccountId: string | null;
    chartAccountCode: string | null;
  };

  const plans: Plan[] = txns.map((txn) => {
    const favNorm = normalizeName(txn.favorecido);
    const isTransfer = TRANSFER_PLANO_CONTA.has(txn.planoConta.trim()) || isTransferFavorecido(txn.favorecido);

    let memberId: string | null = null;
    let memberMatchType: Plan['memberMatchType'] = null;
    let counterpartyName: string | null = null;

    if (!isTransfer && !INTERNAL_LABELS.has(favNorm) && txn.favorecido.trim()) {
      const exact = memberByNorm.get(favNorm);
      if (exact) { memberId = exact.id; memberMatchType = 'exact'; }
      else {
        const fuzzy = fuzzyMemberMatch(favNorm, members);
        if (fuzzy) { memberId = fuzzy.id; memberMatchType = 'fuzzy'; }
        else counterpartyName = txn.favorecido.trim();
      }
    }

    const isCredit = txn.valor > 0;
    const code = isTransfer ? null : mapChartAccountCode(txn.planoConta, isCredit, txn.favorecido);
    const chart = code ? chartByCode.get(code) : null;

    return {
      txn, isTransfer, memberId, memberMatchType, counterpartyName,
      chartAccountId: chart?.id ?? null, chartAccountCode: code,
    };
  });

  // ---------- relatório ----------
  const real = plans.filter((p) => !p.isTransfer);
  const transfers = plans.filter((p) => p.isTransfer);
  const exactMatches = real.filter((p) => p.memberMatchType === 'exact');
  const fuzzyMatches = real.filter((p) => p.memberMatchType === 'fuzzy');
  const external = real.filter((p) => p.counterpartyName);
  const mapped = real.filter((p) => p.chartAccountId);
  const unmapped = real.filter((p) => !p.chartAccountId);
  const totalReal = real.reduce((s, p) => s + p.txn.valor, 0);

  console.log('\n=== Relatório de divergências (dry-run) ===');
  console.log(`Lançamentos reais (receita/despesa): ${real.length} | soma: R$ ${totalReal.toFixed(2)}`);
  console.log(`Transferências internas (ignoradas p/ Account, só BankTransaction): ${transfers.length}`);
  console.log(`  Membro casado (nome exato): ${exactMatches.length}`);
  console.log(`  Membro casado (fuzzy — CONFERIR): ${fuzzyMatches.length}`);
  console.log(`  Contraparte externa (fornecedor/cliente sem cadastro): ${external.length}`);
  console.log(`  Plano de conta mapeado: ${mapped.length}`);
  console.log(`  Plano de conta NÃO mapeado (chartAccountId ficará null — CONFERIR): ${unmapped.length}`);

  console.log('\n-- Casamentos fuzzy (conferir manualmente) --');
  const fuzzySeen = new Set<string>();
  for (const p of fuzzyMatches) {
    const k = `${p.txn.favorecido} -> ${p.memberId}`;
    if (fuzzySeen.has(k)) continue;
    fuzzySeen.add(k);
    const m = members.find((mm) => mm.id === p.memberId);
    console.log(`  "${p.txn.favorecido}" -> ${m?.name}`);
  }

  console.log('\n-- Categorias não mapeadas (soma por categoria) --');
  const byCat = new Map<string, number>();
  for (const p of unmapped) byCat.set(p.txn.planoConta || '(vazio)', (byCat.get(p.txn.planoConta || '(vazio)') ?? 0) + p.txn.valor);
  for (const [cat, sum] of [...byCat.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) {
    console.log(`  ${cat}: R$ ${sum.toFixed(2)}`);
  }

  const reportPath = csvPath.replace(/\.csv$/i, '') + '.import-report.json';
  writeFileSync(reportPath, JSON.stringify({ plans, summary: { total: plans.length, real: real.length, transfers: transfers.length, exactMatches: exactMatches.length, fuzzyMatches: fuzzyMatches.length, external: external.length, mapped: mapped.length, unmapped: unmapped.length, totalReal } }, null, 2), 'utf8');
  console.log(`\nRelatório completo salvo em: ${reportPath}`);

  if (!yes) {
    console.log('\n[SIMULAÇÃO] Nada foi gravado. Revise o relatório acima e o JSON completo.');
    console.log('Para gravar de verdade: rode de novo com --confirm-host <trecho-do-host> --yes');
    return;
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!confirmHost || !dbUrl.includes(confirmHost)) {
    console.error(`\n[RECUSADO] --confirm-host não bate com o DATABASE_URL atual. Isso é uma trava manual de segurança.`);
    process.exitCode = 1;
    return;
  }

  console.log('\nGravando no banco...');
  let created = 0;
  for (const p of plans) {
    const { txn } = p;
    const isCredit = txn.valor > 0;
    const description = `${IMPORT_TAG} | conta:${txn.account} | ${txn.planoConta || '(sem categoria)'}${txn.numero ? ' | nº ' + txn.numero : ''}`;

    if (p.isTransfer) {
      await prismaAdmin.bankTransaction.create({
        data: {
          lodgeId: LODGE_ID,
          date: new Date(txn.date),
          description: `${IMPORT_TAG} | ${txn.account} | ${txn.favorecido || txn.planoConta}`,
          amount: txn.valor,
          status: 'ignored',
        },
      });
      created++;
      continue;
    }

    const account = await prismaAdmin.account.create({
      data: {
        lodgeId: LODGE_ID,
        memberId: p.memberId,
        chartAccountId: p.chartAccountId,
        type: isCredit ? 'RECEIVABLE' : 'PAYABLE',
        title: txn.planoConta || txn.favorecido || 'Lançamento importado',
        amount: Math.abs(txn.valor),
        dueDate: new Date(txn.date),
        status: 'paid',
        isDues: txn.planoConta.trim() === 'Financeiro:Mensalidade',
        description,
        counterpartyName: p.counterpartyName,
      },
    });

    const payment = await prismaAdmin.payment.create({
      data: {
        lodgeId: LODGE_ID,
        accountId: account.id,
        memberId: p.memberId,
        amount: Math.abs(txn.valor),
        paidAt: new Date(txn.date),
        method: 'import',
        note: IMPORT_TAG,
      },
    });

    await prismaAdmin.bankTransaction.create({
      data: {
        lodgeId: LODGE_ID,
        date: new Date(txn.date),
        description: `${IMPORT_TAG} | ${txn.account} | ${txn.favorecido || txn.planoConta}`,
        amount: txn.valor,
        status: 'matched',
        matchedPaymentId: payment.id,
      },
    });
    created++;
  }

  console.log(`\nConcluído: ${created} lançamento(s) processado(s).`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
