'use client';

import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { formatDateOnly } from '@/lib/date-only';

interface MemberOfficeItem {
  id: string;
  office: { id: string; name: string; order: number };
  member: { id: string; name: string; photoUrl: string | null };
}
interface TermData {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  memberOffices: MemberOfficeItem[];
}

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 16mm 14mm; }
  body * { visibility: hidden !important; }
  .qg-print, .qg-print * { visibility: visible !important; }
  .qg-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 9.5pt; }
  .qg-noprint { display: none !important; }
  .qg-print h1, .qg-print h2, .qg-print h3 { color: #111 !important; }
  .qg-print .card { border: 1px solid #ccc !important; break-inside: avoid; page-break-inside: avoid; }
}
`;

export default function QuadroGestaoClient({ lodgeName, crestUrl, term }: { lodgeName: string; crestUrl: string | null; term: TermData | null }) {
  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="qg-noprint">
          <h1 className="font-display text-2xl font-bold text-sand-light">Quadro da Gestão</h1>
          <p className="mt-1 text-sm text-sand-dark">Cargos do período em exercício, com foto — bom para mural, apresentações e prestação de contas.</p>
        </div>

        {!term ? (
          <EmptyState
            title="Nenhum veneralato em exercício."
            description="Crie um período em Veneralato e vincule os cargos para que o quadro apareça aqui."
            action={<Link href="/dashboard/veneralato" className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Ir para Veneralato</Link>}
          />
        ) : term.memberOffices.length === 0 ? (
          <EmptyState
            title="Nenhum cargo vinculado ainda."
            description={`O período "${term.title}" está em exercício, mas nenhum cargo foi vinculado. Faça isso em Veneralato.`}
            action={<Link href="/dashboard/veneralato" className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Ir para Veneralato</Link>}
          />
        ) : (
          <>
            <div className="qg-noprint">
              <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
                Salvar como PDF
              </button>
            </div>

            <section className="rounded-xl border border-white/6 bg-sigma-card p-6 qg-print">
              <header className="mb-6 text-center">
                {crestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
                ) : null}
                <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
                <h2 className="mt-0.5 text-sm text-sand-dark">Quadro da Gestão — {term.title}</h2>
                <p className="mt-0.5 text-xs text-sand-dark">
                  {formatDateOnly(term.startDate)} a {term.endDate ? formatDateOnly(term.endDate) : 'em exercício'}
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {term.memberOffices.map((mo) => (
                  <div key={mo.id} className="card flex flex-col items-center gap-2 rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4 text-center">
                    {mo.member.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mo.member.photoUrl} alt={mo.member.name} className="h-24 w-24 rounded-full border border-white/8 object-cover" />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-white/15 text-sand-dark/50">
                        <UserRound className="h-10 w-10" />
                      </div>
                    )}
                    <p className="text-sm font-semibold text-gold">{mo.office.name}</p>
                    <p className="text-sm text-sand-light">{mo.member.name}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
