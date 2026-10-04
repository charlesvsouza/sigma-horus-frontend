import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PlansSection } from '@/components/plans-section';
import { Reveal } from '@/components/reveal';
import { FOUNDER_PRICE_LOCK_MONTHS, FOUNDER_SLOTS, countPaidLodges, foundersLeft } from '@/lib/founders';
import { PLANS, TRIAL_DAYS } from '@/lib/plans';
import { jsonLdString, landingJsonLd } from '@/lib/seo';

// URL canônica da landing: os links de divulgação com ?utm_… e ?ref=… contam como esta mesma página nos buscadores.
export const metadata: Metadata = { alternates: { canonical: '/' } };

// O contador de vagas de Lojas Fundadoras lê o banco: revalida a cada 10 minutos (sem pesar a página).
export const revalidate = 600;

const modules = [
  {
    numeral: 'I',
    name: 'Tesouraria',
    description:
      'O coração financeiro: cobranças e mensalidades, boletos e PIX com baixa automática, contas a pagar e a receber com cadastro de clientes e fornecedores, contas bancárias e transferências entre elas, conciliação bancária, fechamento de caixa e balancetes, fluxo de caixa projetado e o acompanhamento da inadimplência.',
  },
  {
    numeral: 'II',
    name: 'Secretaria',
    description:
      'A administração viva da loja: membros e cargos, períodos de veneralato, sessões com ordem do dia, convocação por e-mail e balaustre, documentos institucionais sempre à mão de todos — o obreiro acompanha tudo num calendário próprio no portal.',
  },
  {
    numeral: 'III',
    name: 'Chancelaria',
    description:
      'A ordem e a memória: ritos e graus, quadro de obreiros, inventário de materiais e alfaias com fornecimento por grau e termo de entrega, documentos oficiais da loja e o arquivo de prontuários e certificados.',
  },
  {
    numeral: 'IV',
    name: 'Hospitalaria',
    description:
      'O cuidado fraterno: campanhas de benemerência, tronco de beneficência com doação por Pix, felicitações de aniversário e jubileus — e o obreiro pode propor uma campanha ou pedir auxílio direto pelo portal.',
  },
];

// O que o irmão ganha — o argumento que convence a loja: acabou o "fica à mercê do que o tesoureiro fala".
const brotherBenefits = [
  { title: 'Paga pelo portal, com Pix', detail: 'Vê as pendências, clica em Pagar e usa o QR Code — uma conta ou várias num Pix só. No Asaas, a baixa é automática.' },
  { title: 'Confere o próprio histórico', detail: 'Tudo o que já pagou, por período, com o recibo de cada pagamento. Sem depender de ninguém para saber se está em dia.' },
  { title: 'Emite a declaração de regularidade', detail: 'Em dia com a Tesouraria? A declaração oficial da loja sai na hora, para transferência, elevação ou filiação.' },
  { title: 'Recebe o lembrete certo', detail: 'Aviso antes do vencimento por e-mail, WhatsApp ou SMS, já com o link para pagar.' },
];

const brl0 = (cents: number) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

const faq = [
  { q: 'Quanto custa?', a: `Três planos, pelo número de membros ativos: ${Object.values(PLANS).map((p) => `${p.name} (${p.description.replace(/^Para lojas /, '').replace(/\.$/, '')}) a ${brl0(p.price)} por mês`).join('; ')}. Há desconto no plano anual e teste grátis de ${TRIAL_DAYS} dias.` },
  { q: 'Preciso instalar alguma coisa?', a: 'Não. Funciona no navegador do computador e do celular. Cada irmão entra com o próprio e-mail e senha.' },
  { q: 'Quanto tempo dura o teste grátis?', a: 'Dez dias, com todos os módulos do plano escolhido. O cartão é cadastrado no início, mas a primeira cobrança só acontece ao fim do teste — cancele antes e nada é cobrado.' },
  { q: 'Como os irmãos pagam?', a: 'A loja escolhe: direto na conta da loja, com o Pix da chave da loja (sem tarifa do sistema), ou pelo Asaas, com Pix ou boleto e baixa automática. Nos dois casos o irmão paga pelo portal.' },
  { q: 'Os dados da loja ficam seguros?', a: 'Cada loja só enxerga os próprios dados (isolamento no banco), cada cargo só vê a sua área, tudo fica na auditoria e há backup diário criptografado. Conforme a LGPD.' },
  { q: 'Consigo trazer o cadastro de outro sistema?', a: 'Sim. A importação reconhece as colunas da planilha de membros sozinha, e o histórico financeiro também pode ser importado.' },
  { q: 'Serve para a nossa Potência e o nosso rito?', a: 'Sim. Rito, Potência e cargos são configurados pela loja, e os documentos oficiais saem com a fórmula de abertura e o cabeçalho da loja.' },
];

const pillars = [
  { label: 'Dados isolados por loja', detail: 'Cada loja vê só os seus dados, com Row-Level Security no banco.' },
  { label: 'Auditoria de tudo', detail: 'Quem fez, o quê e quando — uma trilha imutável de cada alteração.' },
  { label: 'Conforme a LGPD', detail: 'Acesso por cargo, documentos privados e dados pessoais protegidos.' },
  { label: 'No prumo, no bolso', detail: 'Funciona de verdade no computador e no celular, sem app a instalar.' },
  { label: 'Seus dados, sempre a salvo', detail: 'Backup diário e criptografado de toda a base, com cópia sob demanda pra sua loja.' },
  { label: 'Migração sem dor', detail: 'Importe o cadastro de membros de outro sistema — a ferramenta reconhece as colunas sozinha.' },
];

export default function Home() {
  return (
    <main className="relative">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(landingJsonLd(faq)) }} />
      {/* Fundo egípcio FIXO — sempre visível; o conteúdo rola por cima.
          Véu mais leve para revelar as pirâmides e os camelos ao fundo. */}
      <div aria-hidden="true" className="fixed inset-0 -z-10">
        <Image
          src="/backgraund_theme.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_55%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-sigma-blue-deep/58 via-sigma-blue-deep/42 to-sigma-blue-deep/72" />
      </div>

      {/* ===================== HERO ===================== */}
      <section className="relative flex min-h-[94svh] flex-col">
        {/* Navegação — sem logo: o emblema do herói já é a marca */}
        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-end px-6 py-6 lg:px-10">
          <div className="flex items-center gap-4 text-sm sm:gap-7">
            <a href="#modulos" className="hidden text-sand-light/80 transition-colors hover:text-sand-light sm:inline">
              Módulos
            </a>
            <a href="#planos" className="hidden text-sand-light/80 transition-colors hover:text-sand-light sm:inline">
              Planos
            </a>
            <Link href="/login" className="text-sand-light/80 transition-colors hover:text-sand-light">
              Entrar
            </Link>
            <Link
              href="#planos"
              className="rounded-full bg-gold px-5 py-2 font-medium text-sigma-blue-deep transition-all duration-300 ease-out hover:bg-gold-light"
            >
              Começar
            </Link>
          </div>
        </nav>

        {/* Conteúdo do herói — reveal cerimonial em stagger */}
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-6 pb-20 pt-6 lg:px-10">
          <div className="max-w-2xl">
            <Image
              src="/sigmahorus_ouro.png"
              alt=""
              aria-hidden="true"
              width={1024}
              height={1024}
              priority
              className="animate-rise h-28 w-auto drop-shadow-[0_6px_30px_rgba(0,0,0,0.55)] sm:h-36"
            />
            <p className="animate-rise mt-8 font-display text-xs tracking-[0.42em] text-gold" style={{ animationDelay: '120ms' }}>
              GESTÃO DA LOJA MAÇÔNICA
            </p>
            <h1
              className="animate-rise mt-5 text-balance font-display text-[clamp(2.7rem,6.4vw,5rem)] font-bold leading-[1.04] text-sand-light"
              style={{ animationDelay: '200ms' }}
            >
              Toda a loja,
              <br />
              <span className="text-gold">no prumo.</span>
            </h1>
            <p
              className="animate-rise mt-7 max-w-xl text-lg leading-8 text-sand"
              style={{ animationDelay: '300ms' }}
            >
              Tesouraria, secretaria, chancelaria e hospitalaria — os quatro ofícios da administração
              maçônica em uma só plataforma, segura e com a precisão de quem presta contas.
            </p>
            <ul className="animate-rise mt-6 flex flex-wrap gap-2 text-xs text-sand-light" style={{ animationDelay: '350ms' }} aria-label="Destaques">
              {['Irmão paga pelo portal com Pix', 'Histórico e recibos para cada irmão', 'Inadimplência acompanhada', 'Prestação de contas pronta'].map((t) => (
                <li key={t} className="rounded-full border border-gold/30 bg-sigma-blue-deep/50 px-3 py-1 backdrop-blur-sm">{t}</li>
              ))}
            </ul>
            <div className="animate-rise mt-9 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: '400ms' }}>
              <Link
                href="#planos"
                className="rounded-full bg-gold px-7 py-3 text-center font-medium text-sigma-blue-deep transition-all duration-300 ease-out hover:bg-gold-light"
              >
                Testar grátis por 10 dias
              </Link>
              <a
                href="#modulos"
                className="rounded-full border border-sand-light/25 px-7 py-3 text-center font-medium text-sand-light backdrop-blur-sm transition-colors hover:border-gold/60 hover:text-gold"
              >
                Conhecer os módulos
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== OS QUATRO OFÍCIOS ===================== */}
      <section id="modulos" className="relative border-t border-white/[0.06]">
        <Reveal>
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <p className="font-display text-xs tracking-[0.4em] text-gold">OS QUATRO OFÍCIOS</p>
            <h2 className="mt-5 font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-semibold leading-tight text-sand-light">
              Uma plataforma, a loja inteira
            </h2>
            <p className="mt-4 text-base leading-7 text-sand">
              Cada coluna sustenta um ofício. Juntas, elas erguem a administração completa da sua loja —
              do dinheiro à fraternidade.
            </p>
          </div>

          {/* Arquitrave dourada */}
          <div className="mt-14 h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((m, i) => (
              <div
                key={m.name}
                className={`group relative px-0 py-9 lg:px-8 ${
                  i !== 0 ? 'lg:border-l lg:border-white/[0.07]' : ''
                }`}
              >
                {/* capitel: numeral romano */}
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-3xl font-bold text-gold/90">{m.numeral}</span>
                  <span className="h-px flex-1 bg-white/[0.08] transition-colors group-hover:bg-gold/30" />
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold tracking-wide text-sand-light">{m.name}</h3>
                <p className="mt-3 text-sm leading-6 text-sand-dark">{m.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
      </section>

      {/* ===================== PARA O IRMÃO ===================== */}
      <section className="relative border-t border-white/[0.06]">
        <Reveal>
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
          <div className="max-w-2xl">
            <p className="font-display text-xs tracking-[0.4em] text-gold">PARA O IRMÃO</p>
            <h2 className="mt-5 font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-semibold leading-tight text-sand-light">
              Transparência que o irmão sente
            </h2>
            <p className="mt-4 text-base leading-7 text-sand">
              Cada obreiro tem o seu portal. Ele vê o que deve, paga, confere o que já pagou e emite a própria
              declaração — e a Tesouraria para de responder a mesma pergunta toda semana.
            </p>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {brotherBenefits.map((b) => (
              <div key={b.title} className="border-t border-gold/25 pt-5">
                <h3 className="text-base font-semibold text-sand-light">{b.title}</h3>
                <p className="mt-2 text-sm leading-6 text-sand-dark">{b.detail}</p>
              </div>
            ))}
          </div>
        </div>
        </Reveal>
      </section>

      {/* ===================== A BASE ===================== */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
        <Reveal>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.3rem)] font-semibold leading-tight text-sand-light">
              Construído sobre confiança
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-sand">
              Dados financeiros pedem rigor. Por baixo dos quatro ofícios, o Sigma Horus traz segurança,
              rastreabilidade e conformidade como fundação, não como enfeite.
            </p>
          </div>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {pillars.map((p) => (
              <div key={p.label} className="border-t border-white/[0.08] pt-5">
                <h3 className="text-base font-semibold text-sand-light">{p.label}</h3>
                <p className="mt-2 text-sm leading-6 text-sand-dark">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>
        </Reveal>
      </section>

      {/* ===================== CONCEITO DA MARCA ===================== */}
      <section className="relative border-y border-white/[0.06]">
        <Reveal>
        <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center lg:py-28">
          <Image
            src="/sigmahorus_ouro.png"
            alt="Emblema Sigma Horus — o Olho de Hórus com esquadro e compasso"
            width={1024}
            height={1024}
            className="h-24 w-auto opacity-95 drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
          />
          <p className="mt-8 font-display text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold leading-snug text-sand-light">
            “A tesouraria da sua loja no prumo.”
          </p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-sand">
            O Olho de Hórus mede e protege; o fio de prumo aprova o que está reto. No Egito, suas frações
            somavam o todo — a mesma exatidão que um sistema de contas e prestação de contas exige.
          </p>
        </div>
        </Reveal>
      </section>

      <FoundersSection />

      <PlansSection />

      {/* ===================== PERGUNTAS FREQUENTES ===================== */}
      <section id="perguntas" className="mx-auto max-w-4xl px-6 pb-24 lg:px-10">
        <Reveal>
        <p className="font-display text-xs tracking-[0.4em] text-gold">PERGUNTAS FREQUENTES</p>
        <h2 className="mt-5 font-display text-[clamp(1.6rem,3vw,2.3rem)] font-semibold leading-tight text-sand-light">
          Antes de começar
        </h2>
        <div className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {faq.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-sand-light outline-none focus-visible:text-gold">
                {f.q}
                <span aria-hidden="true" className="text-gold transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-sand-dark">{f.a}</p>
            </details>
          ))}
        </div>
        </Reveal>
      </section>

      {/* ===================== CTA FINAL ===================== */}
      <section className="mx-auto max-w-7xl px-6 pb-28 lg:px-10">
        <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-gold/20 px-8 py-16 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(70% 120% at 50% 0%, color-mix(in srgb, var(--sigma-gold) 12%, transparent), transparent 60%)',
            }}
          />
          <div className="relative">
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold text-sand-light">
              Erga a gestão da sua loja
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-sand">
              Comece hoje com avaliação gratuita. Sem instalar nada, com seus dados isolados e seguros.
            </p>
            <Link
              href="#planos"
              className="mt-8 inline-flex rounded-full bg-gold px-8 py-3 font-medium text-sigma-blue-deep transition-all duration-300 ease-out hover:bg-gold-light"
            >
              Criar conta gratuita
            </Link>
          </div>
        </div>
        </Reveal>
      </section>

      {/* ===================== RODAPÉ ===================== */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 lg:flex-row lg:items-start lg:justify-between lg:px-10">
          <div className="max-w-sm">
            <Image
              src="/sigmahorus_ouro.png"
              alt="Sigma Horus"
              width={1024}
              height={1024}
              className="h-14 w-auto"
            />
            <p className="mt-4 text-sm leading-6 text-sand-dark">
              Tesouraria, secretaria, chancelaria e hospitalaria — a loja maçônica inteira, no prumo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
            <a href="#modulos" className="text-sand-dark transition-colors hover:text-sand-light">Módulos</a>
            <a href="#planos" className="text-sand-dark transition-colors hover:text-sand-light">Planos</a>
            <a href="#perguntas" className="text-sand-dark transition-colors hover:text-sand-light">Perguntas</a>
            <Link href="/login" className="text-sand-dark transition-colors hover:text-sand-light">Entrar</Link>
            <Link href="/sobre" className="text-sand-dark transition-colors hover:text-sand-light">Sobre</Link>
            <Link href="/guias" className="text-sand-dark transition-colors hover:text-sand-light">Guias</Link>
            <Link href="/manual" className="text-sand-dark transition-colors hover:text-sand-light">Manual</Link>
            <Link href="/termos" className="text-sand-dark transition-colors hover:text-sand-light">Termos</Link>
            <Link href="/privacidade" className="text-sand-dark transition-colors hover:text-sand-light">Privacidade</Link>
            <Link href="/compliance" className="text-sand-dark transition-colors hover:text-sand-light">Compliance</Link>
          </div>
        </div>
        <div className="border-t border-white/[0.05] px-6 py-6 text-center text-xs text-sand-dark lg:px-10">
          © {new Date().getFullYear()} Sigma Horus — a tesouraria da sua loja no prumo.
          {' · '}
          <Link href="/plataforma" className="text-sand-dark/60 transition-colors hover:text-sand-light">
            Admin
          </Link>
        </div>
      </footer>
    </main>
  );
}

/** "Lojas Fundadoras": 30 vagas com preço travado por 24 meses. Contador real (assinaturas pagas). */
async function FoundersSection() {
  const paid = await countPaidLodges();
  const left = paid == null ? null : foundersLeft(paid);
  if (left === 0) return null; // oferta encerrada: a seção some sozinha
  return (
    <section id="fundadoras" className="mx-auto max-w-7xl px-6 pt-8 lg:px-10">
      <Reveal>
      <div className="relative overflow-hidden rounded-2xl border border-gold/35 bg-sigma-blue-deep/60 px-8 py-10 backdrop-blur-sm lg:px-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 140% at 100% 0%, color-mix(in srgb, var(--sigma-gold) 14%, transparent), transparent 60%)' }} />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.6fr] lg:items-center">
          <div>
            <p className="font-display text-xs tracking-[0.4em] text-gold">OFERTA DE LANÇAMENTO</p>
            <h2 className="mt-4 font-display text-[clamp(1.6rem,3vw,2.3rem)] font-semibold leading-tight text-sand-light">
              Lojas Fundadoras
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-sand">
              As primeiras {FOUNDER_SLOTS} lojas que assinarem um plano mantêm o preço contratado por
              {' '}{FOUNDER_PRICE_LOCK_MONTHS} meses — sem reajuste — e recebem o selo de <strong className="text-sand-light">Loja Fundadora</strong> do Sigma Horus.
            </p>
            <p className="mt-3 text-xs text-sand-dark">
              Vale para assinatura paga de qualquer plano, mensal ou anual, a partir da data da assinatura. O teste grátis não ocupa vaga.
            </p>
          </div>
          <div className="text-center lg:text-right">
            {left != null ? (
              <p>
                <span className="block font-display text-5xl font-bold text-gold">{left}</span>
                <span className="mt-1 block text-sm text-sand">de {FOUNDER_SLOTS} vagas restantes</span>
              </p>
            ) : null}
            <a href="#planos" className="mt-5 inline-flex rounded-full bg-gold px-7 py-3 font-medium text-sigma-blue-deep transition-all duration-300 ease-out hover:bg-gold-light">
              Garantir a vaga da minha loja
            </a>
          </div>
        </div>
      </div>
      </Reveal>
    </section>
  );
}
