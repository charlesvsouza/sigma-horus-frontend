import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canManageRestrictions, checkRestriction, restrictionBadge, restrictionNotice, restrictionTargetStatus, RESTRICTION_KINDS, type RestrictionInput } from './member-restriction';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const base: RestrictionInput = { kind: 'quit_placet', startedAt: d('2026-10-05'), deliberatedAt: null, expectedEndAt: null, reason: '', destination: '', protocol: '' };
const ctx = { memberStatus: 'active', degree: 'Mestre' as const, openDebt: 0, overdueDebt: 0, hasActiveOfKind: false };

test('catálogo: todo motivo tem artigo e os totais têm situação de destino', () => {
  for (const k of RESTRICTION_KINDS) {
    assert.ok(k.article.length > 0, k.value);
    if (k.scope === 'total') assert.ok(k.status, `${k.value} total sem status`);
    else assert.equal(k.status, undefined, `${k.value} parcial não muda a situação`);
  }
  assert.equal(new Set(RESTRICTION_KINDS.map((k) => k.value)).size, RESTRICTION_KINDS.length);
});

test('quem registra: Venerável, Administrador e Secretário', () => {
  for (const r of ['admin', 'venerable', 'secretary', ' Secretary ']) assert.equal(canManageRestrictions(r), true, r);
  for (const r of ['treasurer', 'member', 'hospitaller', '', null, undefined]) assert.equal(canManageRestrictions(r), false, String(r));
});

test('Quit Placet: Mestre com dívida zerada passa; com dívida em aberto não', () => {
  assert.equal(checkRestriction(base, ctx).ok, true);
  const r = checkRestriction(base, { ...ctx, openDebt: 110 });
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.error : '', /pendências em aberto/);
});

test('Quit Placet é de Mestre; certificado de grau é de Aprendiz/Companheiro', () => {
  const apprentice = { ...ctx, degree: 'Aprendiz' as const };
  assert.equal(checkRestriction(base, apprentice).ok, false);
  assert.equal(checkRestriction({ ...base, kind: 'degree_certificate' }, apprentice).ok, true);
  assert.equal(checkRestriction({ ...base, kind: 'degree_certificate' }, ctx).ok, false);
  // grau desconhecido (cadastro incompleto da migração) não trava
  assert.equal(checkRestriction(base, { ...ctx, degree: null }).ok, true);
});

test('licença: exige motivo, fim previsto, até 6 meses e estar em dia', () => {
  const leave: RestrictionInput = { ...base, kind: 'temporary_leave', reason: 'Viagem a trabalho', expectedEndAt: d('2027-03-05') };
  assert.equal(checkRestriction(leave, ctx).ok, true);
  assert.equal(checkRestriction({ ...leave, reason: '' }, ctx).ok, false);
  assert.equal(checkRestriction({ ...leave, expectedEndAt: null }, ctx).ok, false);
  assert.equal(checkRestriction({ ...leave, expectedEndAt: d('2027-06-01') }, ctx).ok, false, 'mais de 6 meses');
  assert.equal(checkRestriction({ ...leave, expectedEndAt: d('2026-10-01') }, ctx).ok, false, 'fim antes do início');
  assert.equal(checkRestriction(leave, { ...ctx, overdueDebt: 50 }).ok, false, 'em atraso');
  // a dívida a vencer não impede a licença
  assert.equal(checkRestriction(leave, { ...ctx, openDebt: 110, overdueDebt: 0 }).ok, true);
});

test('placet de ofício e suspensão exigem a deliberação da Loja', () => {
  const ex: RestrictionInput = { ...base, kind: 'placet_ex_officio', reason: 'Proposta de três Mestres aprovada' };
  assert.equal(checkRestriction(ex, ctx).ok, false);
  assert.equal(checkRestriction({ ...ex, deliberatedAt: d('2026-10-03') }, ctx).ok, true);
  const susp: RestrictionInput = { ...base, kind: 'disciplinary_suspension', reason: 'Infração grave', deliberatedAt: d('2026-10-03'), expectedEndAt: d('2028-11-01') };
  assert.equal(checkRestriction(susp, ctx).ok, false, 'mais de 2 anos');
  assert.equal(checkRestriction({ ...susp, expectedEndAt: d('2028-10-05') }, ctx).ok, true);
});

test('restrição total só para irmão ativo; bloqueado do Art. 002 e candidato são recusados', () => {
  const ex: RestrictionInput = { ...base, kind: 'elimination', reason: 'Doze meses de mora', deliberatedAt: d('2026-10-03') };
  assert.equal(checkRestriction(ex, { ...ctx, memberStatus: 'blocked' }).ok, false);
  assert.equal(checkRestriction(ex, { ...ctx, memberStatus: 'candidate' }).ok, false);
  assert.equal(checkRestriction(ex, { ...ctx, memberStatus: 'suspended' }).ok, false);
  assert.equal(checkRestriction(ex, ctx).ok, true);
});

test('só registro (advertência, pendência de migração) vale em qualquer situação e não muda o cadastro', () => {
  const warn: RestrictionInput = { ...base, kind: 'registry_pending', reason: 'CPF divergente na migração' };
  assert.equal(checkRestriction(warn, { ...ctx, memberStatus: 'suspended' }).ok, true);
  assert.equal(restrictionTargetStatus('registry_pending'), null);
  assert.equal(restrictionTargetStatus('quit_placet'), 'quit_placet');
  assert.equal(restrictionTargetStatus('elimination'), 'inactive');
});

test('não repete o mesmo motivo em vigor; motivo desconhecido é recusado', () => {
  assert.equal(checkRestriction(base, { ...ctx, hasActiveOfKind: true }).ok, false);
  assert.equal(checkRestriction({ ...base, kind: 'inexistente' }, ctx).ok, false);
});

test('selo e aviso do portal citam o artigo e o motivo', () => {
  assert.equal(restrictionBadge({ kind: 'temporary_leave', expectedEndAt: d('2027-03-05') }), 'Licença temporária até 05/03/2027');
  const n = restrictionNotice({ kind: 'temporary_leave', reason: 'Viagem', expectedEndAt: d('2027-03-05') });
  assert.match(n, /Regulamento Geral, arts\. 147 j e 176 a 179/);
  assert.match(n, /Motivo: Viagem/);
  assert.match(n, /Previsto até 05\/03\/2027/);
  assert.match(restrictionNotice({ kind: 'quit_placet' }), /situação "Quit Placet"/);
});
