import test from 'node:test';
import assert from 'node:assert/strict';
import { canInitiate, candidateMayVisit, deriveStage, greeting, isCandidateRole, parseProcessPatch, stageLabel, stageListFor } from './candidate.ts';

const d = (s: string) => new Date(s);

test('etapa: processo novo começa na pré-proposta', () => {
  assert.equal(deriveStage({}).stage, 'pre_proposal');
});

test('etapa: avança conforme as datas', () => {
  assert.equal(deriveStage({ preProposalDate: d('2026-01-01') }).stage, 'reading');
  assert.equal(deriveStage({ preProposalDate: d('2026-01-01'), proposalReadingDate: d('2026-01-10') }).stage, 'inquiry');
  // sindicância aberta mas sem conclusão continua em sindicância
  assert.equal(deriveStage({ preProposalDate: d('2026-01-01'), proposalReadingDate: d('2026-01-10'), inquiryOpenedAt: d('2026-01-11') }).stage, 'inquiry');
  const base = { preProposalDate: d('2026-01-01'), proposalReadingDate: d('2026-01-10'), inquiryClosedAt: d('2026-02-01'), inquiryResult: 'favorable' };
  assert.equal(deriveStage(base).stage, 'ballot');
  assert.equal(deriveStage({ ...base, ballotDate: d('2026-02-10'), ballotResult: 'approved' }).stage, 'potency');
  assert.equal(deriveStage({ ...base, ballotDate: d('2026-02-10'), ballotResult: 'approved', potencyApprovedAt: d('2026-03-01') }).stage, 'initiation');
});

test('etapa: parecer desfavorável segura a etapa e avisa', () => {
  const s = deriveStage({ preProposalDate: d('2026-01-01'), proposalReadingDate: d('2026-01-10'), inquiryClosedAt: d('2026-02-01'), inquiryResult: 'unfavorable' });
  assert.equal(s.stage, 'inquiry');
  assert.match(s.warning ?? '', /desfavorável/);
});

test('etapa: iniciado e encerrado prevalecem', () => {
  assert.equal(deriveStage({ initiatedAt: d('2026-04-01') }).stage, 'initiated');
  assert.equal(deriveStage({ closedAt: d('2026-04-01'), preProposalDate: d('2026-01-01') }).stage, 'closed');
});

test('iniciação exige escrutínio aprovado e processo aberto', () => {
  assert.equal(canInitiate({}).ok, false);
  assert.equal(canInitiate({ ballotResult: 'rejected' }).ok, false);
  assert.equal(canInitiate({ ballotResult: 'approved' }).ok, true);
  assert.equal(canInitiate({ ballotResult: 'approved', closedAt: d('2026-01-01') }).ok, false);
  assert.equal(canInitiate({ ballotResult: 'approved', initiatedAt: d('2026-01-01') }).ok, false);
});

test('patch parcial: só as chaves enviadas; vazio limpa', () => {
  const r = parseProcessPatch({ ballotDate: '2026-02-10', ballotResult: 'approved', notes: '' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(Object.keys(r.patch).sort(), ['ballotDate', 'ballotResult', 'notes']);
  assert.equal(r.patch.notes, null);
  assert.equal(r.patch.ballotDate?.toISOString().slice(0, 10), '2026-02-10');
});

test('patch: rejeita resultado e data inválidos', () => {
  assert.equal(parseProcessPatch({ ballotResult: 'talvez' }).ok, false);
  assert.equal(parseProcessPatch({ inquiryResult: 'x' }).ok, false);
  assert.equal(parseProcessPatch({ ballotDate: '20266-01-01' }).ok, false);
});

test('papel e saudação do candidato', () => {
  assert.equal(isCandidateRole('Candidate'), true);
  assert.equal(isCandidateRole('member'), false);
  assert.equal(greeting('candidate', 'João'), 'Prezado(a) João,');
  assert.equal(greeting('member', 'João'), 'Prezado Ir∴ João,');
});

test('candidato abre só o portal, recibo, Minha conta e o contrato da taxa', () => {
  assert.equal(candidateMayVisit('/dashboard/portal'), true);
  assert.equal(candidateMayVisit('/dashboard/taxas-de-grau/abc123/contrato'), true);
  assert.equal(candidateMayVisit('/dashboard/taxas-de-grau'), false);
  assert.equal(candidateMayVisit('/dashboard/membros'), false);
});

test('tipo de admissão: rótulos e mensagens da filiação', () => {
  assert.equal(stageLabel('initiation', 'affiliation'), 'Aguardando filiação');
  assert.equal(stageLabel('initiated', 'affiliation'), 'Filiado');
  assert.equal(stageLabel('initiated', null), 'Iniciado');
  assert.equal(stageListFor('affiliation')[5].label, 'Filiação');
  const r = canInitiate({ ballotResult: 'rejected' }, 'affiliation');
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /filiação/);
});

test('patch aceita o tipo de admissão e recusa valor inválido', () => {
  const r = parseProcessPatch({ admissionKind: 'affiliation' });
  assert.ok(r.ok && r.patch.admissionKind === 'affiliation');
  assert.equal(parseProcessPatch({ admissionKind: 'transferencia' }).ok, false);
});
