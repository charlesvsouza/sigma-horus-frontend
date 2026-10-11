import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitOverview } from './overview-layout';
import type { OverviewGroup, OverviewItem } from './overview-server';

const it = (key: string, value: string | number, tone: OverviewItem['tone'] = 'gold'): OverviewItem => ({ key, label: key, value, tone });

const groups: OverviewGroup[] = [
  { title: 'Tesouraria', items: [it('pontualidade', '82%', 'emerald'), it('extrato', 3), it('recorrencias', 0), it('visto', 2), it('art002', 4, 'rose'), it('acordos', 0, 'muted'), it('acordos-atrasados', 0, 'rose')] },
  { title: 'Secretaria', items: [it('proxima', '12/10/2026', 'muted'), it('balaustres', 0), it('candidatos', 2, 'muted'), it('cadastros', 5), it('aniversarios', 0, 'muted')] },
  { title: 'Frequência', items: [it('faltas', 1, 'rose')] },
  { title: 'Hospitalaria', items: [it('tronco', 'R$ 500,00', 'emerald'), it('campanhas', 0, 'muted'), it('pedidos', 0)] },
  { title: 'Loja', items: [it('assinatura', 'ativa', 'emerald')] },
];

test('atenção: só o que é maior que zero, atrasos (vermelho) primeiro', () => {
  const { attention } = splitOverview(groups);
  assert.deepEqual(attention.map((i) => i.key), ['art002', 'faltas', 'extrato', 'visto', 'cadastros']);
});

test('atenção inclui os indicadores calculados pela página (contas/cobranças vencidas, reembolsos)', () => {
  const { attention } = splitOverview(groups, [it('contas-vencidas', 7, 'rose'), it('cobrancas-vencidas', 0, 'rose')]);
  assert.deepEqual(attention.slice(0, 3).map((i) => i.key), ['contas-vencidas', 'art002', 'faltas']);
  assert.equal(attention.some((i) => i.key === 'cobrancas-vencidas'), false, 'zero não aparece');
});

test('acompanhar: informação na ordem fixa; zero some, texto fica', () => {
  const { follow } = splitOverview(groups);
  assert.deepEqual(follow.map((i) => i.key), ['proxima', 'pontualidade', 'tronco', 'candidatos', 'assinatura']);
});

test('indicador ação nunca aparece como acompanhar e vice-versa', () => {
  const { attention, follow } = splitOverview(groups);
  const a = new Set(attention.map((i) => i.key));
  for (const f of follow) assert.equal(a.has(f.key), false, f.key);
});

test('sem nada pendente: lista de atenção vazia', () => {
  const quiet: OverviewGroup[] = [{ title: 'x', items: [it('extrato', 0), it('faltas', 0, 'rose'), it('proxima', '—', 'muted')] }];
  assert.equal(splitOverview(quiet).attention.length, 0);
});
