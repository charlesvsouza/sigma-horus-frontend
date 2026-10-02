// Candidato (profano em processo de admissão). É um Member com status
// 'candidate' e um User com papel 'candidate' (só o portal: meus débitos, meu
// cadastro, pagar). O processo fica em CandidateProcess; a etapa atual é
// derivada das datas aqui — nada de "etapa" gravada que possa divergir delas.
// Quem cadastra, conduz o processo e registra a iniciação: Administrador,
// Venerável e Secretário (permissão members:write).

export const CANDIDATE_STATUS = 'candidate';
export const CANDIDATE_ROLE = 'candidate';

/** Filtro Prisma: só obreiros (exclui candidatos) — quadros, presença, convocações, cobrança em massa. */
export const NOT_CANDIDATE = { status: { not: CANDIDATE_STATUS } };

export const isCandidateRole = (role: string | null | undefined) => (role ?? '').toLowerCase().trim() === CANDIDATE_ROLE;

// Telas do painel que o candidato pode abrir: o portal (débitos, cadastro,
// pagar), o histórico dos próprios pagamentos, o recibo, Minha conta (senha) e o
// contrato do próprio plano de taxa (a página confere que o plano é dele).
const CANDIDATE_PATHS = [/^\/dashboard\/portal\/?$/, /^\/dashboard\/portal\/historico\/?$/, /^\/dashboard\/pagamentos\/[^/]+\/recibo\/?$/, /^\/dashboard\/minha-conta\/?$/, /^\/dashboard\/taxas-de-grau\/[^/]+\/contrato\/?$/];
export const candidateMayVisit = (pathname: string) => CANDIDATE_PATHS.some((re) => re.test(pathname));

// Tipo de admissão: profano que será iniciado, ou maçom de outra loja que se filia.
// Mesmas etapas; muda a última (Iniciação × Filiação) e o que o registro final grava.
export type AdmissionKind = 'initiation' | 'affiliation';
export const ADMISSION_KINDS: { value: AdmissionKind; label: string; event: string; done: string }[] = [
  { value: 'initiation', label: 'Iniciação', event: 'iniciação', done: 'Iniciado' },
  { value: 'affiliation', label: 'Filiação', event: 'filiação', done: 'Filiado' },
];
export const admissionKindOf = (v: string | null | undefined): AdmissionKind => (v === 'affiliation' ? 'affiliation' : 'initiation');
export const admissionDef = (v: string | null | undefined) => ADMISSION_KINDS.find((k) => k.value === admissionKindOf(v))!;

/** Rótulo da etapa considerando o tipo (a 6ª é Iniciação ou Filiação). */
export function stageLabel(stage: CandidateStage, kind: string | null | undefined): string {
  const def = admissionDef(kind);
  if (stage === 'initiation') return `Aguardando ${def.event}`;
  if (stage === 'initiated') return def.done;
  return CANDIDATE_STAGE_LABEL[stage];
}
export const stageListFor = (kind: string | null | undefined) =>
  CANDIDATE_STAGES.map((s) => (s.key === 'initiation' ? { ...s, label: admissionDef(kind).label } : s));

export type CandidateStage = 'pre_proposal' | 'reading' | 'inquiry' | 'ballot' | 'potency' | 'initiation' | 'initiated' | 'closed';

export const CANDIDATE_STAGES: { key: Exclude<CandidateStage, 'initiated' | 'closed'>; label: string }[] = [
  { key: 'pre_proposal', label: 'Pré-proposta' },
  { key: 'reading', label: 'Leitura da proposta' },
  { key: 'inquiry', label: 'Sindicância' },
  { key: 'ballot', label: 'Escrutínio' },
  { key: 'potency', label: 'Autorização da Potência' },
  { key: 'initiation', label: 'Iniciação' },
];

export const CANDIDATE_STAGE_LABEL: Record<CandidateStage, string> = {
  pre_proposal: 'Pré-proposta',
  reading: 'Leitura da proposta',
  inquiry: 'Sindicância',
  ballot: 'Escrutínio',
  potency: 'Autorização da Potência',
  initiation: 'Aguardando iniciação',
  initiated: 'Iniciado',
  closed: 'Encerrado',
};

export const CLOSED_REASONS = [
  { value: 'rejected', label: 'Reprovado' },
  { value: 'withdrawn', label: 'Desistência do candidato' },
  { value: 'archived', label: 'Arquivado' },
] as const;
export type ClosedReason = (typeof CLOSED_REASONS)[number]['value'];
export const closedReasonLabel = (v?: string | null) => CLOSED_REASONS.find((r) => r.value === v)?.label ?? 'Encerrado';

export const OPINIONS = [
  { value: 'favorable', label: 'Favorável' },
  { value: 'unfavorable', label: 'Desfavorável' },
] as const;
export const opinionLabel = (v?: string | null) => OPINIONS.find((o) => o.value === v)?.label ?? 'Aguardando';

type DateLike = Date | string | null | undefined;

export interface ProcessDates {
  preProposalDate?: DateLike;
  proposalReadingDate?: DateLike;
  inquiryOpenedAt?: DateLike;
  inquiryClosedAt?: DateLike;
  inquiryResult?: string | null;
  ballotDate?: DateLike;
  ballotResult?: string | null;
  potencyApprovedAt?: DateLike;
  initiatedAt?: DateLike;
  closedAt?: DateLike;
}

export interface StageInfo {
  stage: CandidateStage;
  /** Índice em CANDIDATE_STAGES (0–5); 6 = iniciado; -1 = encerrado. */
  index: number;
  /** Resultado desfavorável que pede decisão (encerrar o processo). */
  warning: string | null;
}

/** Etapa atual = a primeira ainda não concluída. */
export function deriveStage(p: ProcessDates): StageInfo {
  if (p.initiatedAt) return { stage: 'initiated', index: CANDIDATE_STAGES.length, warning: null };
  if (p.closedAt) return { stage: 'closed', index: -1, warning: null };
  const steps: [CandidateStage, boolean][] = [
    ['pre_proposal', Boolean(p.preProposalDate)],
    ['reading', Boolean(p.proposalReadingDate)],
    ['inquiry', Boolean(p.inquiryClosedAt && p.inquiryResult === 'favorable')],
    ['ballot', Boolean(p.ballotDate && p.ballotResult === 'approved')],
    ['potency', Boolean(p.potencyApprovedAt)],
  ];
  let warning: string | null = null;
  if (p.inquiryResult === 'unfavorable') warning = 'A sindicância concluiu com parecer desfavorável.';
  else if (p.ballotResult === 'rejected') warning = 'O escrutínio reprovou o candidato.';
  const idx = steps.findIndex(([, done]) => !done);
  if (idx === -1) return { stage: 'initiation', index: CANDIDATE_STAGES.length - 1, warning };
  return { stage: steps[idx][0], index: idx, warning };
}

/**
 * Pode registrar a iniciação? Exige processo aberto e escrutínio aprovado.
 * A autorização da Potência não trava (há lojas que a recebem só no dia), mas
 * a tela avisa quando falta.
 */
export function canInitiate(p: ProcessDates, kind?: string | null): { ok: true } | { ok: false; error: string } {
  const ev = admissionDef(kind).event;
  if (p.initiatedAt) return { ok: false, error: `A ${ev} deste candidato já foi registrada.` };
  if (p.closedAt) return { ok: false, error: `O processo está encerrado. Reabra-o antes de registrar a ${ev}.` };
  if (p.ballotResult !== 'approved') return { ok: false, error: `Registre o escrutínio aprovado antes da ${ev}.` };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Corpo da requisição → campos do processo. Só devolve as chaves presentes no
// body (PATCH parcial): chave ausente não é tocada; string vazia limpa.
// ---------------------------------------------------------------------------

const DATE_FIELDS = [
  'preProposalDate', 'proposalReadingDate', 'inquiryOpenedAt', 'inquiryDeadline', 'inquiryClosedAt',
  'ballotDate', 'potencySentAt', 'potencyApprovedAt', 'initiationScheduledAt',
] as const;

export interface ProcessPatch {
  admissionKind?: AdmissionKind;
  proposerId?: string | null;
  preProposalDate?: Date | null;
  proposalReadingDate?: Date | null;
  inquiryOpenedAt?: Date | null;
  inquiryDeadline?: Date | null;
  inquiryClosedAt?: Date | null;
  inquiryResult?: string | null;
  ballotDate?: Date | null;
  ballotResult?: string | null;
  potencySentAt?: Date | null;
  potencyApprovedAt?: Date | null;
  potencyReference?: string | null;
  initiationScheduledAt?: Date | null;
  notes?: string | null;
}

const has = (body: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(body, key);
const text = (v: unknown) => {
  const s = v == null ? '' : String(v).trim();
  return s || null;
};

export function parseProcessPatch(body: Record<string, unknown>): { ok: true; patch: ProcessPatch } | { ok: false; error: string } {
  const patch: ProcessPatch = {};
  for (const key of DATE_FIELDS) {
    if (!has(body, key)) continue;
    const raw = text(body[key]);
    if (!raw) { patch[key] = null; continue; }
    const d = new Date(raw);
    const year = d.getUTCFullYear();
    if (Number.isNaN(d.getTime()) || year < 1900 || year > new Date().getUTCFullYear() + 2) return { ok: false, error: 'Data inválida no processo.' };
    patch[key] = d;
  }
  if (has(body, 'proposerId')) patch.proposerId = text(body.proposerId);
  if (has(body, 'admissionKind')) {
    const v = text(body.admissionKind);
    if (v !== 'initiation' && v !== 'affiliation') return { ok: false, error: 'Tipo de admissão inválido.' };
    patch.admissionKind = v;
  }
  if (has(body, 'potencyReference')) patch.potencyReference = text(body.potencyReference);
  if (has(body, 'notes')) patch.notes = text(body.notes);
  if (has(body, 'inquiryResult')) {
    const v = text(body.inquiryResult);
    if (v && !OPINIONS.some((o) => o.value === v)) return { ok: false, error: 'Resultado da sindicância inválido.' };
    patch.inquiryResult = v;
  }
  if (has(body, 'ballotResult')) {
    const v = text(body.ballotResult);
    if (v && v !== 'approved' && v !== 'rejected') return { ok: false, error: 'Resultado do escrutínio inválido.' };
    patch.ballotResult = v;
  }
  return { ok: true, patch };
}

/** Saudação dos e-mails de acesso: candidato ainda não é Irmão. */
export function greeting(role: string | null | undefined, name: string) {
  return isCandidateRole(role) ? `Prezado(a) ${name},` : `Prezado Ir∴ ${name},`;
}
