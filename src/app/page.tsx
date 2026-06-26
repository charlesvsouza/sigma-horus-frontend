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

// Motivo da marca: o Olho de Hórus abstraído em traços geométricos, atravessado
// por um fio de prumo. Visão + precisão — "a tesouraria da sua loja no prumo".
function HorusMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 260" fill="none" className={className} aria-hidden="true">
      {/* geometria sutil ao fundo */}
      <circle cx="120" cy="96" r="92" className="stroke-gold/10" strokeWidth="1" />
      <circle cx="120" cy="96" r="64" className="stroke-gold/[0.07]" strokeWidth="1" />
      {/* sobrancelha */}
      <path d="M34 72 C84 36 168 36 206 64" className="stroke-gold" strokeWidth="2.25" strokeLinecap="round" />
      {/* pálpebra superior e inferior (amêndoa) */}
      <path d="M40 104 C84 70 158 70 200 100" className="stroke-sand-light" strokeWidth="2.25" strokeLinecap="round" />
      <path d="M40 104 C86 132 158 130 200 100" className="stroke-sand-light" strokeWidth="2.25" strokeLinecap="round" />
      {/* íris / pupila */}
      <circle cx="118" cy="101" r="20" className="stroke-gold" strokeWidth="2.25" />
      <circle cx="118" cy="101" r="7" className="fill-gold" />
      {/* marcação diagonal do wedjat */}
      <path d="M70 122 L44 168" className="stroke-gold/80" strokeWidth="2.25" strokeLinecap="round" />
      {/* voluta */}
      <path d="M120 122 C120 150 150 158 150 134 C150 120 134 120 134 132" className="stroke-gold/80" strokeWidth="2.25" strokeLinecap="round" />
      {/* fio de prumo: vertical descendo da pupila até o pêndulo */}
      <line x1="118" y1="101" x2="118" y2="232" className="stroke-sand-dark/50" strokeWidth="1" strokeDasharray="2 5" />
      <path d="M118 232 l9 16 l-9 8 l-9 -8 z" className="fill-gold stroke-gold" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      {/* Brilho de ouro no alto, evocando o deserto ao entardecer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[680px] opacity-70"
        style={{
          background:
            'radial-gradient(60% 70% at 78% 8%, color-mix(in srgb, var(--sigma-gold) 16%, transparent), transparent 60%), radial-gradient(50% 50% at 12% 0%, color-mix(in srgb, var(--sigma-blue-mid) 35%, transparent), transparent 60%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        {/* Navegação */}
        <nav className="flex items-center justify-between py-7">
          <span className="font-display text-lg tracking-[0.35em] text-sand-light">SIGMA&nbsp;HORUS</span>
          <div className="flex items-center gap-7 text-sm">
            <a href="#modulos" className="hidden text-sand-dark transition-colors hover:text-sand-light sm:inline">Módulos</a>
            <a href="#planos" className="hidden text-sand-dark transition-colors hover:text-sand-light sm:inline">Planos</a>
            <Link href="/login" className="text-sand-dark transition-colors hover:text-sand-light">Entrar</Link>
            <Link
              href="/onboarding"
              className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-sigma-blue-deep transition-all duration-300 ease-out hover:bg-gold-light"
            >
              Começar
            </Link>
          </div>
        </nav>

        {/* Hero assimétrico */}
        <section className="grid items-center gap-12 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-16">
          <div className="animate-slide-up">
            <p className="font-display text-xs tracking-[0.4em] text-gold">GESTÃO DA LOJA MAÇÔNICA</p>
            <h1 className="font-display mt-6 text-balance text-[clamp(2.6rem,6vw,4.6rem)] font-bold leading-[1.05] text-sand-light">
              Toda a loja,
              <br />
              <span className="text-gold">no prumo.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-sand">
              O Sigma Horus reúne os quatro ofícios da administração maçônica — tesouraria, secretaria,
              chancelaria e hospitalaria — em uma só plataforma, segura e com a precisão de quem presta contas.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/onboarding"
                className="rounded-full bg-gold px-7 py-3 text-center font-medium text-sigma-blue-deep transition-all duration-300 ease-out hover:bg-gold-light"
              >
                Começar agora
              </Link>
              <a
                href="#modulos"
                className="rounded-full border border-white/15 px-7 py-3 text-center font-medium text-sand-light transition-colors hover:border-gold/50 hover:text-gold"
              >
                Conhecer os módulos
              </a>
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <HorusMark className="h-auto w-[min(78vw,420px)] animate-fade-in" />
          </div>
        </section>
      </div>

      {/* Os quatro módulos — colunata de templo sob um arquitrave dourado */}
      <section id="modulos" className="relative border-t border-white/[0.06] bg-sigma-blue-dark/40">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <p className="font-display text-xs tracking-[0.4em] text-gold">OS QUATRO OFÍCIOS</p>
            <h2 className="font-display mt-5 text-[clamp(1.8rem,3.5vw,2.6rem)] font-semibold leading-tight text-sand-light">
              Uma plataforma, a loja inteira
            </h2>
            <p className="mt-4 text-base leading-7 text-sand">
              Cada coluna sustenta um ofício. Juntas, elas erguem a administração completa da sua loja —
              do dinheiro à fraternidade.
            </p>
          </div>

          {/* Arquitrave */}
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
                <h3 className="font-display mt-5 text-xl font-semibold tracking-wide text-sand-light">{m.name}</h3>
                <p className="mt-3 text-sm leading-6 text-sand-dark">{m.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pilares transversais */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="font-display text-xs tracking-[0.4em] text-gold">A BASE</p>
            <h2 className="font-display mt-5 text-[clamp(1.6rem,3vw,2.3rem)] font-semibold leading-tight text-sand-light">
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

      {/* Faixa de conceito da marca */}
      <section className="relative border-y border-white/[0.06] bg-sigma-blue-dark/40">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center lg:py-28">
          <HorusMark className="h-auto w-20 opacity-90" />
          <p className="font-display mt-8 text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold leading-snug text-sand-light">
            “A tesouraria da sua loja no prumo.”
          </p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-sand">
            O olho de Hórus mede e protege; o fio de prumo aprova o que está reto. No Egito, suas frações
            somavam o todo — a mesma exatidão que um sistema de contas e prestação de contas exige.
          </p>
        </div>
      </section>

      <PlansSection />

      {/* CTA final */}
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

      {/* Rodapé */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 lg:flex-row lg:items-start lg:justify-between lg:px-10">
          <div className="max-w-sm">
            <span className="font-display text-base tracking-[0.35em] text-sand-light">SIGMA&nbsp;HORUS</span>
            <p className="mt-3 text-sm leading-6 text-sand-dark">
              Tesouraria, secretaria, chancelaria e hospitalaria — a loja maçônica inteira, no prumo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
            <a href="#modulos" className="text-sand-dark transition-colors hover:text-sand-light">Módulos</a>
            <a href="#planos" className="text-sand-dark transition-colors hover:text-sand-light">Planos</a>
            <Link href="/login" className="text-sand-dark transition-colors hover:text-sand-light">Entrar</Link>
            <Link href="/sobre" className="text-sand-dark transition-colors hover:text-sand-light">Sobre</Link>
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
