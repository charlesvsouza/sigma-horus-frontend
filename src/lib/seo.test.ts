import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonLdString, landingJsonLd } from './seo.ts';

const faq = [{ q: 'Quanto custa?', a: 'Três planos.' }, { q: 'Tem <script> aqui?', a: 'Não </script> fecha.' }];

test('JSON-LD da landing: organização, site, software com os 3 planos e FAQ igual à página', () => {
  const g = landingJsonLd(faq)['@graph'];
  assert.deepEqual(g.map((n) => n['@type']), ['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']);
  const app = g.find((n) => n['@type'] === 'SoftwareApplication') as { offers: { name: string; price: string; priceCurrency: string }[] };
  assert.deepEqual(app.offers.map((o) => [o.name, o.price, o.priceCurrency]), [['Plano Oficina', '110.00', 'BRL'], ['Plano Loja', '170.00', 'BRL'], ['Plano Potência', '220.00', 'BRL']]);
  const spec = (app as unknown as { offers: { priceSpecification: { price: string; billingDuration: number; unitCode: string } }[] }).offers.map((o) => o.priceSpecification);
  assert.deepEqual(spec.map((s) => [s.price, s.billingDuration, s.unitCode]), [['110.00', 1, 'MON'], ['170.00', 1, 'MON'], ['220.00', 1, 'MON']]);
  assert.ok(!JSON.stringify(g).includes('aggregateRating') && !JSON.stringify(g).includes('review'));
  const page = g.find((n) => n['@type'] === 'FAQPage') as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  assert.deepEqual(page.mainEntity.map((m) => m.name), faq.map((f) => f.q));
});

test('JSON dentro de <script> nunca fecha a tag', () => {
  const s = jsonLdString(landingJsonLd(faq));
  assert.ok(!s.includes('</script>'));
  assert.ok(!s.includes('<'));
  assert.equal(JSON.parse(s)['@graph'][3].mainEntity[1].acceptedAnswer.text, 'Não </script> fecha.');
});
