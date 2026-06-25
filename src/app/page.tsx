import { PlansSection } from '@/components/plans-section';

const features = [
  {
    title: "Tesouraria inteligente",
    description: "Controle financeiro, cobranças e baixa de contas em um só lugar.",
  },
  {
    title: "Cobranças automáticas",
    description: "Emita boletos e acompanhe pagamentos com automação e recorrência.",
  },
  {
    title: "Gestão da loja",
    description: "Membros, cargos, sessões, presença e relatórios em uma experiência moderna.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(201,162,77,0.25),_transparent_30%),linear-gradient(135deg,_#07111f_0%,_#0f172a_100%)] text-slate-100">
      <section className="mx-auto flex max-w-7xl flex-col px-6 py-20 lg:px-8">
        <nav className="mb-16 flex items-center justify-between">
          <div className="text-xl font-semibold tracking-[0.2em] text-amber-300">
            SIGMA HORUS
          </div>
          <div className="flex items-center gap-4">
            <a href="#planos" className="text-sm text-slate-300 transition hover:text-white">Planos</a>
            <a href="/login" className="text-sm text-slate-300 transition hover:text-white">Entrar</a>
            <a
              href="/onboarding"
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-300"
            >
              Começar
            </a>
          </div>
        </nav>

        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm text-amber-200">
              SaaS para gestão financeira e administrativa de lojas maçônicas
            </p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              A tesouraria da sua loja no prumo.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              O Sigma Horus centraliza cobranças, contas a pagar e receber, presença,
              relatórios e auditoria em uma plataforma moderna, segura e preparada
              para crescer com a sua loja.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/onboarding"
                className="rounded-full bg-amber-400 px-6 py-3 text-center font-medium text-slate-950 transition hover:bg-amber-300"
              >
                Começar agora
              </a>
              <a
                href="#recursos"
                className="rounded-full border border-slate-700 px-6 py-3 text-center font-medium text-slate-100 transition hover:bg-slate-800"
              >
                Ver recursos
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="rounded-2xl border border-amber-400/20 bg-slate-950/80 p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Resumo do mês</p>
                  <p className="text-2xl font-semibold text-white">R$ 48.250</p>
                </div>
                <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-300">
                  +12,4%
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-800/80 p-4">
                  <p className="text-sm text-slate-400">Cobranças em aberto</p>
                  <p className="mt-1 text-xl font-semibold text-white">18 boletos</p>
                </div>
                <div className="rounded-xl bg-slate-800/80 p-4">
                  <p className="text-sm text-slate-400">Membros ativos</p>
                  <p className="mt-1 text-xl font-semibold text-white">142</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h2 className="text-xl font-semibold text-white">{feature.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <PlansSection />

      <section id="contato" className="mx-auto max-w-7xl px-6 pb-24 lg:px-8">
        <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-8 text-center">
          <h2 className="text-2xl font-semibold text-white">Pronto para modernizar a gestão da sua loja?</h2>
          <p className="mt-3 text-slate-300">
            Acompanhe tesouraria, presença e cobrança com uma plataforma preparada para o presente e para o futuro.
          </p>
          <a
            href="/onboarding"
            className="mt-6 inline-flex rounded-full bg-amber-400 px-6 py-3 font-medium text-slate-950 transition hover:bg-amber-300"
          >
            Criar conta gratuita
          </a>
        </div>
      </section>
    </main>
  );
}
