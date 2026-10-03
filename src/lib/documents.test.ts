import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewDocument, degreeAllowsDocument, documentDegreeRank, isCandidacyCategory, isInternalCategory, memberCanAccessDocument, memberDocumentRank, parseDocumentDegree, DOCUMENT_CATEGORY_SUGGESTIONS, type DocumentViewer } from './documents.ts';

test('"Interno Loja" não é mais sugerida (virou o grau mínimo), mas segue restrita nos documentos antigos', () => {
  assert.ok(!DOCUMENT_CATEGORY_SUGGESTIONS.includes('Interno Loja'));
  assert.equal(isInternalCategory('Interno Loja'), true);
});

test('categoria interna é reconhecida sem depender de maiúsculas/espaços', () => {
  assert.equal(isInternalCategory('Interno Loja'), true);
  assert.equal(isInternalCategory('  interno loja '), true);
  assert.equal(isInternalCategory('Institucional'), false);
  assert.equal(isInternalCategory(null), false);
});

test('irmão: vê institucional e os próprios, nunca o interno nem o de outro irmão', () => {
  assert.equal(memberCanAccessDocument({ memberId: null, category: 'Institucional' }, 'm1'), true);
  assert.equal(memberCanAccessDocument({ memberId: null, category: null }, 'm1'), true);
  assert.equal(memberCanAccessDocument({ memberId: 'm1', category: 'Geral' }, 'm1'), true);
  assert.equal(memberCanAccessDocument({ memberId: 'm2', category: 'Geral' }, 'm1'), false);
  assert.equal(memberCanAccessDocument({ memberId: null, category: 'Interno Loja' }, 'm1'), false);
  assert.equal(memberCanAccessDocument({ memberId: 'm1', category: 'interno loja' }, 'm1'), false);
  assert.equal(memberCanAccessDocument({ memberId: 'm1', category: 'Geral' }, null), false);
});

test('pasta do candidato ("Processo de admissão") é sigilosa como "Interno Loja"', () => {
  assert.equal(isInternalCategory('Processo de admissão'), true);
  assert.equal(memberCanAccessDocument({ memberId: 'm1', category: 'processo de admissão' }, 'm1'), false);
});

test('pasta do candidato sai da lista geral de Documentos', () => {
  assert.equal(isCandidacyCategory(' processo de admissão '), true);
  assert.equal(isCandidacyCategory('Interno Loja'), false);
  assert.equal(isCandidacyCategory(null), false);
});

const d = (s: string) => new Date(s + 'T00:00:00Z');
const viewer = (over: Partial<DocumentViewer>): DocumentViewer => ({ seesAll: false, isCandidate: false, isMemberRole: true, memberId: 'm1', rank: 1, ...over });

test('grau do irmão vem das datas de evolução (instalado > mestre > companheiro > aprendiz)', () => {
  assert.equal(memberDocumentRank(null), 0);
  assert.equal(memberDocumentRank({}), 0);
  assert.equal(memberDocumentRank({ initiationDate: d('2020-01-01') }), 1);
  assert.equal(memberDocumentRank({ initiationDate: d('2020-01-01'), elevationDate: d('2021-01-01') }), 2);
  assert.equal(memberDocumentRank({ initiationDate: d('2020-01-01'), elevationDate: d('2021-01-01'), exaltationDate: d('2022-01-01') }), 3);
  assert.equal(memberDocumentRank({ initiationDate: d('2020-01-01'), installationDate: d('2024-01-01') }), 4);
});

test('grau mínimo: o documento de Companheiro é visto por Companheiro, Mestre e Mestre Instalado — nunca por Aprendiz', () => {
  assert.equal(parseDocumentDegree('fellow'), 'fellow');
  assert.equal(parseDocumentDegree('xyz'), null);
  assert.equal(parseDocumentDegree(''), null);
  assert.equal(documentDegreeRank('fellow'), 2);
  for (const [rank, ok] of [[0, false], [1, false], [2, true], [3, true], [4, true]] as const) assert.equal(degreeAllowsDocument('fellow', rank), ok, 'rank ' + rank);
  // sem grau mínimo = todos (inclusive sem grau cadastrado)
  assert.equal(degreeAllowsDocument(null, 0), true);
  assert.equal(degreeAllowsDocument(undefined, 1), true);
});

test('canViewDocument: Aprendiz não vê o de Mestre; Mestre vê o de Aprendiz; quem envia vê tudo', () => {
  const master = { memberId: null, category: 'Geral', minDegree: 'master' };
  const apprentice = { memberId: null, category: 'Geral', minDegree: 'apprentice' };
  assert.equal(canViewDocument(master, viewer({ rank: 1 })), false);
  assert.equal(canViewDocument(master, viewer({ rank: 3 })), true);
  assert.equal(canViewDocument(master, viewer({ rank: 4 })), true);
  assert.equal(canViewDocument(apprentice, viewer({ rank: 3 })), true);
  assert.equal(canViewDocument(apprentice, viewer({ rank: 0 })), false);
  assert.equal(canViewDocument(master, viewer({ seesAll: true, isMemberRole: false, rank: 0 })), true);
});

test('canViewDocument: o cargo sem papel Membro (ex.: Tesoureiro) também respeita o grau; documento pessoal ignora o grau', () => {
  const master = { memberId: null, category: null, minDegree: 'master' };
  assert.equal(canViewDocument(master, viewer({ isMemberRole: false, rank: 1 })), false);
  assert.equal(canViewDocument(master, viewer({ isMemberRole: false, rank: 3 })), true);
  assert.equal(canViewDocument({ memberId: 'm1', category: 'Geral', minDegree: 'master' }, viewer({ rank: 1 })), true);
  assert.equal(canViewDocument({ memberId: 'm2', category: 'Geral', minDegree: null }, viewer({ rank: 4 })), false);
});

test('canViewDocument: documentos antigos do Interno Loja continuam sem aparecer para o irmão; candidato não vê nada', () => {
  assert.equal(canViewDocument({ memberId: null, category: 'Interno Loja', minDegree: null }, viewer({ rank: 4 })), false);
  assert.equal(canViewDocument({ memberId: null, category: 'Interno Loja', minDegree: null }, viewer({ seesAll: true, isMemberRole: false })), true);
  const candidate = viewer({ isCandidate: true, isMemberRole: false, rank: 0 });
  assert.equal(canViewDocument({ memberId: null, category: null, minDegree: null }, candidate), false);
  assert.equal(canViewDocument({ memberId: 'm1', category: null, minDegree: null }, candidate), false);
  assert.equal(canViewDocument({ memberId: null, category: null, minDegree: null }, { ...candidate, seesAll: true }), false);
});

test('memberCanAccessDocument com o grau do irmão', () => {
  assert.equal(memberCanAccessDocument({ memberId: null, category: null, minDegree: 'master' }, 'm1', 2), false);
  assert.equal(memberCanAccessDocument({ memberId: null, category: null, minDegree: 'master' }, 'm1', 3), true);
  assert.equal(memberCanAccessDocument({ memberId: null, category: null, minDegree: 'master' }, 'm1'), true); // sem rank informado: regra antiga
});
