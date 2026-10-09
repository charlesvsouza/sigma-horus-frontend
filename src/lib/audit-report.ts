// Relatório de intervenções da Auditoria: o que cada pessoa ("quem") fez em um período
// escolhido à mão. Regras puras (sem banco) — a página carrega as linhas e chama buildAuditReport.

export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  account: 'Conta',
  member: 'Membro',
  invoice: 'Fatura',
  payment: 'Pagamento',
  session: 'Sessão',
  office: 'Cargo',
  term: 'Período',
  memberOffice: 'Vinculação',
  cashClose: 'Fechamento',
  user: 'Usuário',
  lodge: 'Loja',
  candidate: 'Candidato',
  integration: 'Integração',
  venerableGalleryEntry: 'Galeria de Veneráveis',
  materialLoan: 'Empréstimo de material',
  material: 'Material',
  materialIncident: 'Ocorrência de material',
  degreeFeePlan: 'Taxa de grau',
  financialAccount: 'Conta bancária',
  counterparty: 'Cliente ou fornecedor',
  campaign: 'Campanha',
  asset: 'Patrimônio',
  visitor: 'Visitante',
  legacy_import: 'Importação de backup',
  balancete: 'Balancete',
  accountTransfer: 'Transferência entre contas',
  rolePermission: 'Permissão do cargo',
  platform_impersonation: 'Acesso pelo suporte da plataforma',
  login_failed: 'Entrada recusada',
  password_reset_requested: 'Pedido de nova senha',
  message: 'Mensagem',
  donation: 'Doação',
  document: 'Documento',
  certificate: 'Certificado',
  budget: 'Orçamento',
  'chart-account': 'Conta do plano de contas',
  'chart-split': 'Separação de contas do plano de contas',
  'tronco-intake': 'Entrada do Tronco de Beneficência',
  'tronco-qr-refund': 'Estorno do Pix do Tronco',
  'member-block': 'Bloqueio do irmão',
  'member-block-signature': 'Assinatura do acordo de bloqueio',
  'member-block-payment': 'Pagamento do acordo de bloqueio',
  'member-restriction': 'Restrição do cadastro',
  'ledger-rectification': 'Retificação do caixa',
  'ledger-rectification-use': 'Uso de retificação do caixa',
  'ledger-checkpoint': 'Conferência do caixa',
  'hospitality-request': 'Pedido de hospitalaria',
  'session-visitor': 'Visitante da sessão',
  'session-convocacao': 'Convocação de sessão',
  'campaign-convocacao': 'Convocação de campanha',
  'campaign-donation': 'Doação da campanha',
  'payment-split': 'Pagamento dividido',
  'payment-receipt-signature': 'Assinatura digital do recibo',
  'member-payment-notice': 'Aviso "Já paguei"',
  'member-payment-notice-check': 'Conferência do aviso "Já paguei"',
  'member-payment-notice-reject': 'Recusa do aviso "Já paguei"',
  'agreement-payment-notice': 'Aviso de pagamento do acordo',
  'asaas-cash-pending': 'Recebido em dinheiro, a conferir (Asaas)',
  'asaas-cash-confirmed': 'Recebido em dinheiro, confirmado (Asaas)',
  'asaas-refund': 'Estorno automático (Asaas)',
  'asaas-duplicate-receipt': 'Pagamento em duplicidade (Asaas)',
  'absence-alert': 'Aviso de faltas seguidas',
  'invoice-bulk': 'Faturas em lote',
  'fund-contribution': 'Contribuição ao fundo',
  'lodge-seed': 'Dados iniciais da loja',
  'lodge-offices-seed': 'Cargos iniciais da loja',
  'lodge-collection': 'Modo de cobrança da loja',
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Remoção',
  approve: 'Aprovação',
  approve_expense: 'Aprovação de despesa',
  asaas_charge: 'Cobrança emitida (Asaas)',
  asaas_group_charge: 'Cobrança agrupada (Asaas)',
  block: 'Bloqueio',
  end: 'Encerramento',
  lock: 'Trava',
  unlock: 'Destrava',
  preview: 'Prévia',
  recurring: 'Recorrência',
  renegotiate: 'Renegociação',
  send: 'Envio',
  'recurrence-renew': 'Renovação da recorrência',
  'regularize-after-settlement': 'Regularização após a baixa',
  'reset-password': 'Nova senha',
};

/** Nomes em português para as chaves gravadas nos detalhes (o que não está aqui aparece como veio). */
const DETAIL_KEY_LABEL: Record<string, string> = {
  emailStatus: 'situação do e-mail',
  via: 'por meio de',
  email: 'e-mail',
  role: 'cargo',
  resetPassword: 'nova senha pedida',
  passwordReset: 'senha redefinida',
  memberId: 'irmão',
  lastSessionId: 'última sessão',
  grantedAccess: 'acesso liberado',
  event: 'evento',
  emailChanged: 'e-mail alterado para',
  emailChangeRequested: 'troca de e-mail pedida para',
  changedPassword: 'senha alterada',
  count: 'quantidade',
  code: 'código',
  asaasPaymentId: 'cobrança no Asaas',
  amount: 'valor',
  name: 'nome',
  method: 'forma de pagamento',
  accountId: 'conta',
  anonymized: 'anonimizado',
  anticipatedTo: 'antecipado para',
  approved: 'aprovado',
  asUserId: 'entrou como',
  asaasAutoEmit: 'emissão automática no Asaas',
  asaasBillingType: 'forma de cobrança no Asaas',
  asaasCancelled: 'cobrança cancelada no Asaas',
  asaasSettlementAccountId: 'conta de recebimento no Asaas',
  asaasWebhook: 'aviso automático do Asaas',
  auto: 'automático',
  bank: 'banco',
  bankAccountId: 'conta bancária',
  bankTxId: 'lançamento do extrato',
  billingType: 'forma de cobrança',
  canceled: 'cancelado',
  cardSurcharge: 'acréscimo do cartão',
  cash: 'dinheiro',
  changed: 'alterado',
  channel: 'canal',
  channels: 'canais',
  chartAccountId: 'conta do plano de contas',
  closed: 'encerrado',
  closingBalance: 'saldo final',
  collectionMode: 'modo de cobrança',
  confirmed: 'confirmado',
  cpfFilled: 'CPF preenchido',
  created: 'criado',
  degree: 'grau',
  degrees: 'graus',
  document: 'documento',
  duesBenefit: 'benefício da mensalidade',
  env: 'ambiente',
  excluded: 'excluído',
  exempt: 'isento',
  expectedEventDate: 'data prevista',
  fee: 'taxa',
  field: 'campo',
  fields: 'campos',
  files: 'arquivos',
  from: 'de',
  fromId: 'origem',
  fund: 'fundo',
  fundedFromTronco: 'pago com o Tronco',
  inheritedFrom: 'herdado de',
  inquirers: 'sindicantes',
  installments: 'parcelas',
  invoices: 'faturas',
  items: 'itens',
  key: 'chave',
  kind: 'tipo',
  label: 'nome',
  lateCharge: 'multa e juros',
  leftover: 'sobra',
  lines: 'linhas',
  lodgeId: 'loja',
  materialId: 'material',
  member: 'irmão',
  minDegree: 'grau mínimo',
  moved: 'movidos',
  number: 'número',
  office: 'cargo',
  officeId: 'cargo',
  party: 'parte',
  paymentMethod: 'forma de pagamento',
  payments: 'pagamentos',
  pendingPlan: 'plano pendente',
  periodFrom: 'período de',
  periodTo: 'período até',
  phoneId: 'telefone',
  plan: 'plano',
  plannedAmount: 'valor previsto',
  potencyOnly: 'só a Potência',
  protocol: 'protocolo',
  quantity: 'quantidade',
  quantityDelta: 'variação da quantidade',
  reason: 'motivo',
  receiptCheck: 'conferência do comprovante',
  refund: 'estorno',
  rejected: 'recusado',
  removed: 'removido',
  reopened: 'reaberto',
  reopenedBankLines: 'lançamentos do extrato reabertos',
  repetitions: 'repetições',
  resolution: 'decisão',
  scope: 'abrangência',
  selfEdit: 'edição pela própria pessoa',
  selfSignup: 'cadastro pela própria pessoa',
  sessionId: 'sessão',
  sid: 'sessão',
  source: 'origem',
  status: 'situação',
  target: 'destino',
  template: 'modelo',
  templateId: 'modelo',
  templateNumber: 'número do modelo',
  termId: 'período',
  title: 'título',
  toId: 'destino',
  total: 'total',
  type: 'tipo',
  value: 'valor',
  year: 'ano',
};

const SYSTEM_ACTOR_LABEL: Record<string, string> = {
  'asaas-auto-emit': 'emissão automática no Asaas',
  'asaas-webhook': 'aviso automático do Asaas',
  cron: 'rotina automática',
  'platform-import': 'importação pela plataforma',
  'recurring-invoices': 'cobranças recorrentes',
};
const detailKey = (k: string) => DETAIL_KEY_LABEL[k] ?? k;
const DETAIL_VALUE_LABEL: Record<string, string> = {
  'reset-link': 'link de nova senha',
  'platform-owner-token': 'chave da plataforma',
  'forgot-password': 'esqueci a senha',
  'account-edit': 'edição da conta',
  'bank-statement': 'extrato bancário',
  'bank-statement-agreement': 'extrato bancário (acordo)',
  photo: 'foto',
  minutes: 'ata',
  certificateArt: 'arte do certificado',
  crest: 'brasão',
  matrix: 'matriz',
  confirmed: 'confirmado',
  pending: 'pendente',
  sandbox: 'testes',
  production: 'produção',
  RECEIVABLE: 'a receber',
  PAYABLE: 'a pagar',
  REVENUE: 'receita',
  EXPENSE: 'despesa',
  BOLETO: 'boleto',
  PIX: 'Pix',
  pix: 'Pix',
  CREDIT_CARD: 'cartão de crédito',
  asaas: 'Asaas',
  cash: 'dinheiro',
  donation: 'doação',
  fund: 'fundo',
  import: 'importação',
  manual: 'manual',
  paid: 'paga',
  approved: 'aprovado',
  rejected: 'recusado',
  active: 'ativo',
  closed: 'encerrado',
  completed: 'concluído',
  canceled: 'cancelado',
  open: 'aberto',
  draft: 'rascunho',
  loan: 'empréstimo',
  initiation: 'iniciação',
  elevation: 'elevação',
  exaltation: 'exaltação',
  affiliation: 'filiação',
  supplier: 'fornecedor',
  client: 'cliente',
  both: 'cliente e fornecedor',
};
const detailValue = (v: unknown) => (v === true ? 'sim' : v === false ? 'não' : DETAIL_VALUE_LABEL[String(v)] ?? String(v));

export const entityLabel = (e: string) => AUDIT_ENTITY_LABEL[e] ?? e;
export const actionLabel = (a: string) => AUDIT_ACTION_LABEL[a] ?? a;

/** Teto de linhas por relatório (a página avisa quando o período estoura). */
export const AUDIT_REPORT_LIMIT = 5000;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Período em dias de Brasília (createdAt é instante): 00:00 do "de" a 23:59:59.999 do "até". */
export function auditPeriodBounds(from: string | null | undefined, to: string | null | undefined): { gte?: Date; lte?: Date } {
  const gte = from && DAY.test(from) ? new Date(`${from}T00:00:00.000-03:00`) : undefined;
  const lte = to && DAY.test(to) ? new Date(`${to}T23:59:59.999-03:00`) : undefined;
  return {
    ...(gte && !Number.isNaN(gte.getTime()) ? { gte } : {}),
    ...(lte && !Number.isNaN(lte.getTime()) ? { lte } : {}),
  };
}

export interface AuditReportInput {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  before?: string | null;
  after?: string | null;
  createdAt: Date | string;
  userId: string | null;
  userName?: string | null;
}

export interface AuditReportRow {
  id: string;
  at: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
  viaSuperadmin: boolean;
}

export interface AuditReportActor {
  /** userId, "system:…" ou "system". */
  key: string;
  name: string;
  system: boolean;
  total: number;
  byAction: Record<string, number>;
  rows: AuditReportRow[];
}

export interface AuditReport {
  actors: AuditReportActor[];
  total: number;
  byAction: Record<string, number>;
}

function parseJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const HIDDEN_KEYS = new Set(['viaSuperadmin', 'actor']);

/** Resumo legível dos detalhes gravados ("chave: valor · …"), sem segredos nem ruído, cortado em `max`. */
export function summarizeDetail(after: string | null | undefined, max = 160): string {
  if (!after) return '';
  const obj = parseJson(after);
  if (!obj) return after.length > max ? `${after.slice(0, max - 1)}…` : after;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (HIDDEN_KEYS.has(k) || v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') continue;
    parts.push(`${detailKey(k)}: ${detailValue(v)}`);
  }
  const text = parts.join(' · ');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Quem fez: usuário, ator de sistema (webhook/cron — userId nulo, ator no metadata) ou "Sistema". */
export function actorOf(e: Pick<AuditReportInput, 'userId' | 'userName' | 'after'>): { key: string; name: string; system: boolean } {
  if (e.userId) return { key: e.userId, name: e.userName?.trim() || 'Usuário removido', system: false };
  const actor = parseJson(e.after)?.actor;
  if (typeof actor === 'string' && actor) {
    const raw = actor.replace(/^system:/, '');
    return { key: actor, name: `Sistema (${SYSTEM_ACTOR_LABEL[raw] ?? raw})`, system: true };
  }
  return { key: 'system', name: 'Sistema', system: true };
}

/**
 * Agrupa as intervenções por pessoa (mais ativa primeiro; empate por nome) e ordena as linhas de
 * cada uma da mais antiga para a mais recente. `onlyActor` filtra uma pessoa (userId ou chave de sistema).
 */
export function buildAuditReport(entries: AuditReportInput[], onlyActor?: string | null): AuditReport {
  const map = new Map<string, AuditReportActor>();
  const byAction: Record<string, number> = {};
  let total = 0;
  for (const e of entries) {
    const who = actorOf(e);
    if (onlyActor && who.key !== onlyActor) continue;
    const at = (e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt)).toISOString();
    let a = map.get(who.key);
    if (!a) {
      a = { ...who, total: 0, byAction: {}, rows: [] };
      map.set(who.key, a);
    }
    a.total += 1;
    a.byAction[e.action] = (a.byAction[e.action] ?? 0) + 1;
    byAction[e.action] = (byAction[e.action] ?? 0) + 1;
    total += 1;
    a.rows.push({
      id: e.id, at, action: e.action, entity: e.entity, entityId: e.entityId,
      detail: summarizeDetail(e.after), viaSuperadmin: Boolean(parseJson(e.after)?.viaSuperadmin),
    });
  }
  const actors = [...map.values()];
  for (const a of actors) a.rows.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
  actors.sort((x, y) => y.total - x.total || x.name.localeCompare(y.name, 'pt-BR'));
  return { actors, total, byAction };
}
