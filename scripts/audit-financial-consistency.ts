/**
 * Auditoria SOMENTE LEITURA da consistência financeira (todas as lojas): procura contradições entre contas,
 * pagamentos, cobranças, acordos e extrato — o tipo de falha que não derruba o sistema, mas deixa saldo errado.
 * Cada verificação mostra quantas linhas violam a regra e alguns exemplos (loja + id).
 *
 * Uso (na pasta apps/frontend):
 *   env -u DATABASE_URL -u APP_DATABASE_URL node --env-file=.env --import ./test/setup.mjs scripts/audit-financial-consistency.ts
 */
import { prismaAdmin } from '../src/lib/prisma';

interface Check { id: string; title: string; sql: string; severity: 'alta' | 'media' | 'info' }

const T = 0.005; // tolerância de meio centavo

const CHECKS: Check[] = [
  {
    id: 'paid-sem-pagamento', severity: 'alta',
    title: 'Conta a receber de irmão marcada "paga" sem pagamentos que cubram o valor',
    sql: `SELECT a.id, l.slug, a.amount, COALESCE(SUM(p.amount),0) AS pago FROM "Account" a JOIN "Lodge" l ON l.id=a."lodgeId" LEFT JOIN "Payment" p ON p."accountId"=a.id
          WHERE a.type='RECEIVABLE' AND a."memberId" IS NOT NULL AND a.status='paid' GROUP BY a.id, l.slug HAVING COALESCE(SUM(p.amount),0) + ${T} < a.amount`,
  },
  {
    title: 'Conta a receber de irmão "pendente" com pagamentos que já cobrem o valor', id: 'pendente-coberta', severity: 'alta',
    sql: `SELECT a.id, l.slug, a.amount, SUM(p.amount) AS pago FROM "Account" a JOIN "Lodge" l ON l.id=a."lodgeId" JOIN "Payment" p ON p."accountId"=a.id
          WHERE a.type='RECEIVABLE' AND a."memberId" IS NOT NULL AND a.status<>'paid' GROUP BY a.id, l.slug HAVING SUM(p.amount) + ${T} >= a.amount`,
  },
  {
    id: 'pago-a-mais', severity: 'media',
    title: 'Conta com mais pagamento do que o valor (pagamento em excesso)',
    sql: `SELECT a.id, l.slug, a.amount, SUM(p.amount) AS pago FROM "Account" a JOIN "Lodge" l ON l.id=a."lodgeId" JOIN "Payment" p ON p."accountId"=a.id
          GROUP BY a.id, l.slug HAVING SUM(p.amount) > a.amount + ${T}`,
  },
  {
    id: 'payable-paga-sem-pagamento', severity: 'alta',
    title: 'Conta a pagar marcada "paga" sem nenhum pagamento (a despesa não saiu do caixa)',
    sql: `SELECT a.id, l.slug, a.amount FROM "Account" a JOIN "Lodge" l ON l.id=a."lodgeId" LEFT JOIN "Payment" p ON p."accountId"=a.id
          WHERE a.type='PAYABLE' AND a.status='paid' GROUP BY a.id, l.slug HAVING COUNT(p.id)=0`,
  },
  {
    id: 'payment-sem-banco', severity: 'alta',
    title: 'Pagamento sem conta bancária/caixa (não entra em nenhum saldo)',
    sql: `SELECT p.id, l.slug, p.amount, p."paidAt" FROM "Payment" p JOIN "Lodge" l ON l.id=p."lodgeId" WHERE p."bankAccountId" IS NULL`,
  },
  {
    id: 'payment-valor-invalido', severity: 'alta',
    title: 'Pagamento com valor zero ou negativo',
    sql: `SELECT p.id, l.slug, p.amount FROM "Payment" p JOIN "Lodge" l ON l.id=p."lodgeId" WHERE p.amount <= 0`,
  },
  {
    id: 'payment-data-futura', severity: 'media',
    title: 'Pagamento com data no futuro (mais de 1 dia à frente)',
    sql: `SELECT p.id, l.slug, p.amount, p."paidAt" FROM "Payment" p JOIN "Lodge" l ON l.id=p."lodgeId" WHERE p."paidAt" > now() + interval '1 day'`,
  },
  {
    id: 'invoice-paga-conta-aberta', severity: 'alta',
    title: 'Cobrança "paga" cuja conta (de um irmão) continua em aberto',
    sql: `SELECT i.id, l.slug, i.number, i.amount FROM "Invoice" i JOIN "Lodge" l ON l.id=i."lodgeId" JOIN "Account" a ON a.id=i."accountId"
          WHERE i.status='paid' AND a."memberId" IS NOT NULL AND a.status<>'paid'`,
  },
  {
    id: 'invoice-aberta-conta-paga', severity: 'media',
    title: 'Cobrança aberta cuja conta (de um irmão) já está paga (cobrança fantasma no portal e na fila)',
    sql: `SELECT i.id, l.slug, i.number, i.status FROM "Invoice" i JOIN "Lodge" l ON l.id=i."lodgeId" JOIN "Account" a ON a.id=i."accountId"
          WHERE i.status NOT IN ('paid','cancelled','canceled') AND a."memberId" IS NOT NULL AND a.status='paid'`,
  },
  {
    id: 'mensalidade-sem-irmao', severity: 'alta',
    title: 'Mensalidade (isDues) a receber sem irmão vinculado (não entra no Art. 002 de ninguém)',
    sql: `SELECT a.id, l.slug, a.title, a.amount FROM "Account" a JOIN "Lodge" l ON l.id=a."lodgeId" WHERE a."isDues" AND a.type='RECEIVABLE' AND a."memberId" IS NULL`,
  },
  {
    id: 'conta-sem-categoria', severity: 'media',
    title: 'Contas sem categoria do plano de contas (caem em "sem classificação" no balancete)',
    sql: `SELECT a.id, l.slug, a.title, a.amount FROM "Account" a JOIN "Lodge" l ON l.id=a."lodgeId" WHERE a."chartAccountId" IS NULL AND a.status<>'paid'`,
  },
  {
    id: 'data-absurda', severity: 'media',
    title: 'Vencimento fora de um intervalo plausível (antes de 2015 ou depois de 2035 — possível erro de digitação)',
    sql: `SELECT a.id, l.slug, a.title, a."dueDate" FROM "Account" a JOIN "Lodge" l ON l.id=a."lodgeId" WHERE a."dueDate" < '2015-01-01' OR a."dueDate" > '2035-12-31'`,
  },
  {
    id: 'pagamento-duplicado', severity: 'alta',
    title: 'Pagamentos idênticos (mesma conta, valor, dia e método) — possível baixa em duplicidade',
    sql: `SELECT MIN(p.id) AS id, l.slug, p."accountId", p.amount, p."paidAt", p.method, COUNT(*) AS vezes FROM "Payment" p JOIN "Lodge" l ON l.id=p."lodgeId"
          GROUP BY l.slug, p."accountId", p.amount, p."paidAt", p.method, p.note HAVING COUNT(*) > 1`,
  },
  {
    id: 'extrato-conciliado-sem-pagamento', severity: 'media',
    title: 'Linha de extrato "conciliada" sem pagamento ligado',
    sql: `SELECT b.id, l.slug, b.amount, b.description FROM "BankTransaction" b JOIN "Lodge" l ON l.id=b."lodgeId" WHERE b.status='matched' AND b."matchedPaymentId" IS NULL`,
  },
  {
    id: 'bloqueado-sem-acordo', severity: 'alta',
    title: 'Irmão "bloqueado" sem acordo aberto ou quitado (ninguém consegue liberar)',
    sql: `SELECT m.id, l.slug, m.name FROM "Member" m JOIN "Lodge" l ON l.id=m."lodgeId" WHERE m.status='blocked'
          AND NOT EXISTS (SELECT 1 FROM "MemberBlock" b WHERE b."memberId"=m.id AND b.status IN ('open','settled'))`,
  },
  {
    id: 'acordo-sem-irmao-bloqueado', severity: 'media',
    title: 'Acordo de regularização aberto/quitado cujo irmão não está bloqueado (acordo de quitação de irmão ativo é válido; regularização não)',
    sql: `SELECT b.id, l.slug, b.kind, b.status, m.status AS "statusIrmao" FROM "MemberBlock" b JOIN "Lodge" l ON l.id=b."lodgeId" JOIN "Member" m ON m.id=b."memberId"
          WHERE b.status IN ('open','settled') AND m.status<>'blocked'`,
  },
  {
    id: 'acordo-item-orfao', severity: 'alta',
    title: 'Item de acordo apontando para uma conta que não existe mais',
    sql: `SELECT i.id, l.slug, i.kind, i.title FROM "MemberBlockItem" i JOIN "Lodge" l ON l.id=i."lodgeId" WHERE NOT EXISTS (SELECT 1 FROM "Account" a WHERE a.id=i."accountId")`,
  },
  {
    id: 'recorrencia-sem-proxima', severity: 'media',
    title: 'Cobrança recorrente ligada mas sem data da próxima ocorrência (a recorrência para em silêncio)',
    sql: `SELECT i.id, l.slug, i.number FROM "Invoice" i JOIN "Lodge" l ON l.id=i."lodgeId" WHERE i."isRecurring" AND i."nextDueDate" IS NULL`,
  },
  {
    id: 'mensagem-presa', severity: 'info',
    title: 'Mensagens "queued" há mais de 2 dias (e-mail/WhatsApp que nunca saiu)',
    sql: `SELECT m.id, l.slug, m.channel, m.title, m.error FROM "MessageLog" m JOIN "Lodge" l ON l.id=m."lodgeId" WHERE m.status='queued' AND m."createdAt" < now() - interval '2 days'`,
  },
  {
    id: 'cpf-duplicado', severity: 'media',
    title: 'Dois irmãos da mesma loja com o mesmo CPF',
    sql: `SELECT MIN(m.id) AS id, l.slug, regexp_replace(m.cpf,'\\D','','g') AS cpf, COUNT(*) AS vezes FROM "Member" m JOIN "Lodge" l ON l.id=m."lodgeId"
          WHERE m.cpf IS NOT NULL AND length(regexp_replace(m.cpf,'\\D','','g')) = 11 GROUP BY l.slug, regexp_replace(m.cpf,'\\D','','g') HAVING COUNT(*) > 1`,
  },
  {
    id: 'financial-account-inativa-com-movimento', severity: 'info',
    title: 'Conta bancária/caixa inativa que tem pagamentos nos últimos 30 dias',
    sql: `SELECT f.id, l.slug, f.name, COUNT(p.id) AS pagamentos FROM "FinancialAccount" f JOIN "Lodge" l ON l.id=f."lodgeId" JOIN "Payment" p ON p."bankAccountId"=f.id
          WHERE NOT f.active AND p."paidAt" > now() - interval '30 days' GROUP BY f.id, l.slug, f.name`,
  },
];

async function main() {
  let high = 0;
  let total = 0;
  for (const c of CHECKS) {
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await prismaAdmin.$queryRawUnsafe<Record<string, unknown>[]>(c.sql);
    } catch (e) {
      console.log(`?? ${c.id}: erro na consulta — ${(e as Error).message.split('\n')[0]}`);
      continue;
    }
    const mark = rows.length === 0 ? 'OK ' : c.severity === 'alta' ? 'ALTA' : c.severity === 'media' ? 'MÉD ' : 'INFO';
    console.log(`[${mark}] ${rows.length === 0 ? '' : `(${rows.length}) `}${c.title}`);
    if (rows.length > 0) {
      total += rows.length;
      if (c.severity === 'alta') high += rows.length;
      for (const r of rows.slice(0, 5)) console.log('       ', JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));
    }
  }
  console.log(`\nResumo: ${total} ocorrência(s), ${high} de severidade alta.`);
  process.exitCode = high > 0 ? 2 : 0;
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prismaAdmin.$disconnect());
