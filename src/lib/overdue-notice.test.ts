import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canReceiveOverdueNotice, OVERDUE_NOTICE_INTERVAL_DAYS, overdueNoticeHtml, overdueNoticeRef, overdueNoticeSubject, overdueNoticeText,
  overdueNoticeWhatsApp, overdueNoticeWindowStart, type OverdueNoticeInput,
} from './overdue-notice';

const base: OverdueNoticeInput = {
  memberName: 'João Silva', lodgeName: 'Loja Exemplo 139', count: 3, total: 330, oldestDueDate: new Date('2026-07-05T00:00:00Z'), daysOverdue: 92,
  art002Enabled: true, hasLateFees: true, portalUrl: 'https://app.sigmahorus.com.br/portal', instructions: null,
};

test('assunto cita a loja', () => {
  assert.equal(overdueNoticeSubject('Loja Exemplo 139'), 'Pendências vencidas na Tesouraria da Loja Exemplo 139');
});

test('e-mail: resumo, atenção, Art. 002, portal, parcelamento e comprovante', () => {
  const t = overdueNoticeText(base);
  assert.match(t, /^Caro irmão João Silva,/);
  assert.match(t, /Constam em aberto, na Tesouraria da Loja Exemplo 139, 3 cobranças vencidas, no total de R\$\s?330,00, a mais antiga vencida em 05\/07\/2026 \(há 92 dias\)\./);
  assert.match(t, /aumenta o custo para o irmão, com multa e juros conforme as regras da Loja e, passados 60 dias de atraso, leva ao enquadramento na Lei nº 002, que dispõe sobre a inadimplência dos Obreiros e dá outras providências\./);
  assert.match(t, /Seu cadastro já se enquadra nesse prazo/);
  assert.match(t, /Você pode pagar pelo portal: https:\/\/app\.sigmahorus\.com\.br\/portal/);
  assert.match(t, /é possível conversar sobre o parcelamento\./);
  assert.match(t, /Se já pagou, desconsidere este aviso e, por favor, nos envie o comprovante\./);
  assert.match(t, /Fraternalmente, Tesouraria\.$/);
});

test('quem ainda não passou de 60 dias não recebe a frase de "já se enquadra"', () => {
  const t = overdueNoticeText({ ...base, daysOverdue: 40 });
  assert.doesNotMatch(t, /já se enquadra/);
  assert.match(t, /enquadramento na Lei nº 002/);
  assert.equal(overdueNoticeText({ ...base, daysOverdue: 60 }).includes('já se enquadra'), false, '60 dias ainda não é enquadrado');
  assert.equal(overdueNoticeText({ ...base, daysOverdue: 61 }).includes('já se enquadra'), true);
});

test('singular, sem multa/juros e loja com o Art. 002 desligado', () => {
  const one = overdueNoticeText({ ...base, count: 1, daysOverdue: 1, hasLateFees: false });
  assert.match(one, /, 1 cobrança vencida,/);
  assert.match(one, /\(há 1 dia\)/);
  assert.doesNotMatch(one, /multa e juros/);
  const off = overdueNoticeText({ ...base, art002Enabled: false });
  assert.doesNotMatch(off, /Art\. 002|Lei nº 002/);
  assert.doesNotMatch(off, /já se enquadra/);
  assert.doesNotMatch(overdueNoticeWhatsApp({ ...base, art002Enabled: false }), /Lei nº 002|Art\. 002/);
});

test('forma de pagamento: portal, dados da loja ou procurar a Tesouraria', () => {
  const ins = overdueNoticeText({ ...base, portalUrl: null, instructions: 'Pix (chave): 123' });
  assert.match(ins, /Como pagar:\nPix \(chave\): 123/);
  assert.match(overdueNoticeText({ ...base, portalUrl: null, instructions: null }), /Para pagar, procure a Tesouraria\./);
});

test('WhatsApp: texto do Venerável Mestre, em três parágrafos', () => {
  assert.equal(overdueNoticeWhatsApp(base), [
    'Caro irmão João Silva, constam 3 cobranças vencidas na Tesouraria da Loja Exemplo 139, somando R$ 330,00 (a mais antiga vencida há 92 dias). Para não aumentar os custos do atraso e evitar o enquadramento na Lei nº 002, que dispõe sobre a inadimplência dos Obreiros e dá outras providências, pedimos que regularize essa situação o quanto antes.',
    'Pague pelo portal: https://app.sigmahorus.com.br/portal ou fale comigo para parcelar.',
    'Se já pagou, responda enviando o comprovante. Fraternalmente, Tesouraria',
  ].join('\n'));
  // singular, sem portal (dados da loja) e sem nada cadastrado
  assert.match(overdueNoticeWhatsApp({ ...base, count: 1, daysOverdue: 1 }), /, consta 1 cobrança vencida na Tesouraria .* \(a mais antiga vencida há 1 dia\)\./);
  assert.match(overdueNoticeWhatsApp({ ...base, portalUrl: null, instructions: 'Pix (chave): 123' }), /Como pagar — Pix \(chave\): 123\. Se preferir, fale comigo para parcelar\./);
  assert.match(overdueNoticeWhatsApp({ ...base, portalUrl: null }), /Fale comigo para pagar ou parcelar\./);
  // o mesmo texto vale antes e depois dos 60 dias
  assert.equal(overdueNoticeWhatsApp({ ...base, daysOverdue: 30 }).includes('Lei nº 002'), true);
});

test('HTML escapa o nome e traz o botão do portal', () => {
  const h = overdueNoticeHtml({ ...base, memberName: 'Joao <b>X</b>' });
  assert.match(h, /Joao &lt;b&gt;X&lt;\/b&gt;/);
  assert.match(h, /href="https:\/\/app\.sigmahorus\.com\.br\/portal"/);
  assert.match(h, /Pagar pelo portal/);
});

test('só irmão ativo recebe; janela de 7 dias; ref por irmão', () => {
  assert.equal(canReceiveOverdueNotice({ status: 'active' }), true);
  for (const status of ['blocked', 'suspended', 'inactive', 'quit_placet', 'placet_ex_officio', 'candidate']) assert.equal(canReceiveOverdueNotice({ status }), false, status);
  assert.equal(canReceiveOverdueNotice({ status: 'active', deceased: true }), false);
  const now = new Date('2026-10-05T12:00:00Z');
  assert.equal(OVERDUE_NOTICE_INTERVAL_DAYS, 7);
  assert.equal(overdueNoticeWindowStart(now).toISOString(), '2026-09-28T12:00:00.000Z');
  assert.equal(overdueNoticeRef('abc'), 'overdue-notice:abc');
});
