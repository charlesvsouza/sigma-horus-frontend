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
  assert.match(t, /aumenta o custo para o irmão, com multa e juros conforme as regras da Loja e, passados 60 dias de atraso, leva ao enquadramento no Art\. 002, com os desdobramentos previstos junto à Potência\./);
  assert.match(t, /Seu cadastro já se enquadra nesse prazo/);
  assert.match(t, /Você pode pagar pelo portal: https:\/\/app\.sigmahorus\.com\.br\/portal/);
  assert.match(t, /é possível conversar sobre o parcelamento\./);
  assert.match(t, /Se já pagou, desconsidere este aviso e, por favor, nos envie o comprovante\./);
  assert.match(t, /Fraternalmente, Tesouraria\.$/);
});

test('quem ainda não passou de 60 dias não recebe a frase de "já se enquadra"', () => {
  const t = overdueNoticeText({ ...base, daysOverdue: 40 });
  assert.doesNotMatch(t, /já se enquadra/);
  assert.match(t, /enquadramento no Art\. 002/);
  assert.equal(overdueNoticeText({ ...base, daysOverdue: 60 }).includes('já se enquadra'), false, '60 dias ainda não é enquadrado');
  assert.equal(overdueNoticeText({ ...base, daysOverdue: 61 }).includes('já se enquadra'), true);
});

test('singular, sem multa/juros e loja com o Art. 002 desligado', () => {
  const one = overdueNoticeText({ ...base, count: 1, daysOverdue: 1, hasLateFees: false });
  assert.match(one, /, 1 cobrança vencida,/);
  assert.match(one, /\(há 1 dia\)/);
  assert.doesNotMatch(one, /multa e juros/);
  const off = overdueNoticeText({ ...base, art002Enabled: false });
  assert.doesNotMatch(off, /Art\. 002/);
  assert.doesNotMatch(off, /já se enquadra/);
  assert.doesNotMatch(overdueNoticeWhatsApp({ ...base, art002Enabled: false }), /Art\. 002/);
});

test('forma de pagamento: portal, dados da loja ou procurar a Tesouraria', () => {
  const ins = overdueNoticeText({ ...base, portalUrl: null, instructions: 'Pix (chave): 123' });
  assert.match(ins, /Como pagar:\nPix \(chave\): 123/);
  assert.match(overdueNoticeText({ ...base, portalUrl: null, instructions: null }), /Para pagar, procure a Tesouraria\./);
});

test('WhatsApp: versão curta nos dois casos (antes e depois dos 60 dias)', () => {
  const after = overdueNoticeWhatsApp(base);
  assert.match(after, /^Caro irmão João Silva, constam 3 cobranças vencidas na Tesouraria da Loja Exemplo 139, somando R\$\s?330,00 \(a mais antiga vencida há 92 dias\)\./);
  assert.match(after, /seu cadastro já se enquadra no Art\. 002 \(mais de 60 dias\)\./);
  assert.match(after, /Pague pelo portal: https:\/\/app\.sigmahorus\.com\.br\/portal ou fale com o Tesoureiro para parcelar\./);
  const before = overdueNoticeWhatsApp({ ...base, daysOverdue: 30 });
  assert.match(before, /evitar o enquadramento no Art\. 002 \(mais de 60 dias\), pedimos que regularize o quanto antes\./);
  assert.ok(!after.includes('\n'), 'WhatsApp numa mensagem corrida');
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
