import Image from 'next/image';
import Link from 'next/link';
import { PlansSection } from '@/components/plans-section';

const modules = [
  {
    numeral: 'I',
    name: 'Tesouraria',
    description:
      'O coração financeiro: cobranças e mensalidades, boletos e PIX com baixa automática, contas a pagar e a receber, fechamento de caixa e balancetes.',
  },
  {
    numeral: 'II',
    name: 'Secretaria',
    description:
      'A administração viva da loja: membros e cargos, períodos de veneralato, convocações, sessões com registro de presença, atas e documentos.',
  },
  {
    numeral: 'III',
    name: 'Chancelaria',
    description:
      'A ordem e a memória: ritos e graus, quadro de obreiros, correspondência oficial, prontuários e emissão de certificados.',
  },
  {
    numeral: 'IV',
    name: 'Hospitalaria',
    description:
      'O cuidado fraterno: assistência a obreiros e famílias, tronco de beneficência, acompanhamento, aniversários e visitas.',
  },
];

const pillars = [
  { label: 'Multi-loja, isolado', detail: 'Cada loja vê só os seus dados, com Row-Level Security no banco.' },
  { label: 'Auditoria de tudo', detail: 'Quem fez, o quê e quando — uma trilha imutável de cada alteração.' },
  { label: 'Conforme a LGPD', detail: 'Acesso por cargo, documentos privados e dados pessoais protegidos.' },
  { label: 'No prumo, no bolso', detail: 'Funciona de verdade no computador e no celular, sem app a instalar.' },
];

export default function Home() {
  return (
    <main className="relative overflow-x-clip">
      {/* ===================== HERO CINEMATOGRÁFICO ===================== */}
      <section className="relative isolate flex min-h-[94svh] flex-col overflow-hidden">
        {/* Cena egípcia — mesma atmosfera da tela de login, para coesão landing↔app */}
        <div className="absolute inset-0 -z-10">
          <Image
            src="/backgraund_theme.png"
            alt="Pirâmides de Gizé sob o deserto dourado ao entardecer"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          {/* Véu azul-noite: legibilidade + gravidade institucional.
              Esquerda densa (onde mora o texto), direita aberta (pirâmide visível). */}
          <div className="absolute inset-0 bg-gradient-to-b from-sigma-blue-deep/75 via-sigma-blue-deep/45 to-sigma-blue-deep" />
          <div className="absolute inset-0 bg-gradient-to-r from-sigma-blue-deep via-sigma-blue-deep/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-sigma-blue-deep/70 via-transparent to-transparent" />
        </div>

        {/* Navegação sobre a foto */}
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
          <Link href="/" className="flex items-center" aria-label="Sigma Horus — início">
            <Image
              src="/sigmahorus_ouro.png"
              alt="Sigma Horus"
              width={1024}
              height={1024}
              priority
              className="h-12 w-auto drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
            />
          </Link>
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
              href="/onboarding"
              className="rounded-full bg-gold px-5 py-2 font-medium text-sigma-blue-deep transition-all duration-300 ease-out hover:bg-gold-light"
            >
              Começar
            </Link>
          </div>
        </nav>

        {/* Conteúdo do herói — reveal cerimonial em stagger */}
        <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-6 pb-20 pt-6 lg:px-10">
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
            <div className="animate-rise mt-9 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: '400ms' }}>
              <Link
                href="/onboarding"
                className="rounded-full bg-gold px-7 py-3 text-center font-medium text-sigma-blue-deep transition-all duration-300 ease-out hover:bg-gold-light"
              >
                Começar agora
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
      <section id="modulos" className="relative border-t border-white/[0.06] bg-sigma-blue-dark/40">
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
      </section>

      {/* ===================== A BASE ===================== */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
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
      </section>

      {/* ===================== CONCEITO DA MARCA ===================== */}
      <section className="relative border-y border-white/[0.06] bg-sigma-blue-dark/40">
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
      </section>

      <PlansSection />

      {/* ===================== CTA FINAL ===================== */}
      <section className="mx-auto max-w-7xl px-6 pb-28 lg:px-10">
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
              href="/onboarding"
              className="mt-8 inline-flex rounded-full bg-gold px-8 py-3 font-medium text-sigma-blue-deep transition-all duration-300 ease-out hover:bg-gold-light"
            >
              Criar conta gratuita
            </Link>
          </div>
        </div>
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
            <Link href="/login" className="text-sand-dark transition-colors hover:text-sand-light">Entrar</Link>
            <Link href="/sobre" className="text-sand-dark transition-colors hover:text-sand-light">Sobre</Link>
            <Link href="/manual" className="text-sand-dark transition-colors hover:text-sand-light">Manual</Link>
            <Link href="/termos" className="text-sand-dark transition-colors hover:text-sand-light">Termos</Link>
            <Link href="/privacidade" className="text-sand-dark transition-colors hover:text-sand-light">Privacidade</Link>
            <Link href="/compliance" className="text-sand-dark transition-colors hover:text-sand-light">Compliance</Link>
          </div>
        </div>
        <div className="border-t border-white/[0.05] px-6 py-6 text-center text-xs text-sand-dark lg:px-10">
          © {new Date().getFullYear()} Sigma Horus — a tesouraria da sua loja no prumo.
        </div>
      </footer>
    </main>
  );
}
