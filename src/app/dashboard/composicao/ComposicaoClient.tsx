'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { CollapsibleCard, EmptyState, inputClass } from '@/components/ui';
import { formatDateOnly } from '@/lib/date-only';
import { memberStatusLabel } from '@/lib/member-status';

interface TermOption { id: string; title: string; status: string; startDate: string; endDate: string | null }
interface OfficeRef { id: string; name: string; order: number }
interface Holder {
  id: string;
  name: string;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  degree: string;
  offices: OfficeRef[];
}
interface VacantOffice { id: string; name: string; riteName: string | null }

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 16mm 14mm; }
  body * { visibility: hidden !important; }
  .comp-print, .comp-print * { visibility: visible !important; }
  .comp-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 9.5pt; }
  .comp-noprint { display: none !important; }
  .comp-print h1, .comp-print h2, .comp-print h3 { color: #111 !important; }
  .comp-print table { width: 100%; border-collapse: collapse; }
  .comp-print th, .comp-print td { border-bottom: 1px solid #ddd !important; padding: 4px 6px; text-align: left; color: #111 !important; }
  .comp-print th { text-transform: uppercase; font-size: 8pt; border-bottom: 1.5px solid #333 !important; }
  .comp-print tr { break-inside: avoid; page-break-inside: avoid; }
}
`;

export default function ComposicaoClient({
  lodgeName,
  crestUrl,
  terms,
  selectedTermId,
  members,
  vacant,
  showContacts,
  canManage,
}: {
  lodgeName: string;
  crestUrl: string | null;
  terms: TermOption[];
  selectedTermId: string | null;
  members: Holder[];
  vacant: VacantOffice[];
  showContacts: boolean;
  /** Quem gere o veneralato vê o atalho para vincular cargos. */
  canManage: boolean;
}) {
  const router = useRouter();
  const term = terms.find((t) => t.id === selectedTermId) ?? null;
  const officeCount = members.reduce((sum, m) => sum + m.offices.length, 0);

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="comp-noprint flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Composição da loja</h1>
            <p className="mt-1 text-sm text-sand-dark">
              Todos os obreiros que desempenham cargos no período, com o(s) cargo(s) de cada um e o grau{showContacts ? ' e o contato' : ''}.
              Para o mural com fotos, veja o <Link href="/dashboard/quadro-gestao" className="text-gold hover:text-gold-light">Quadro da Gestão</Link>.
            </p>
          </div>
          {terms.length > 1 ? (
            <label className="text-xs text-sand-dark">
              Período
              <select
                value={selectedTermId ?? ''}
                onChange={(e) => router.push(`/dashboard/composicao?termo=${encodeURIComponent(e.target.value)}`)}
                className={`${inputClass} mt-1 block min-w-56`}
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}{t.status === 'active' ? ' (em exercício)' : ''}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {!term ? (
          <EmptyState
            title="Nenhum veneralato cadastrado."
            description={canManage ? 'Crie um período em Veneralato e vincule os cargos para que a composição apareça aqui.' : 'A Secretaria ainda não cadastrou o veneralato desta loja.'}
            action={canManage ? <Link href="/dashboard/veneralato" className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Ir para Veneralato</Link> : undefined}
          />
        ) : members.length === 0 ? (
          <EmptyState
            title="Nenhum cargo vinculado neste período."
            description={canManage ? `O período "${term.title}" não tem cargos vinculados. Faça isso em Veneralato.` : `O período "${term.title}" ainda não tem cargos vinculados.`}
            action={canManage ? <Link href="/dashboard/veneralato" className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Ir para Veneralato</Link> : undefined}
          />
        ) : (
          <>
            <div className="comp-noprint">
              <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
                Salvar como PDF
              </button>
            </div>

            <section className="comp-print rounded-xl border border-white/6 bg-sigma-card p-6">
              <header className="mb-6 text-center">
                {crestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
                ) : null}
                <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
                <h2 className="mt-0.5 text-sm text-sand-dark">Composição da loja — {term.title}</h2>
                <p className="mt-0.5 text-xs text-sand-dark">
                  {formatDateOnly(term.startDate)} a {term.endDate ? formatDateOnly(term.endDate) : 'em exercício'}
                  {' · '}{members.length} {members.length === 1 ? 'obreiro' : 'obreiros'} em {officeCount} {officeCount === 1 ? 'cargo' : 'cargos'}
                </p>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-sand-dark/70">
                      <th className="border-b border-white/10 px-2 py-2">Obreiro</th>
                      <th className="border-b border-white/10 px-2 py-2">Cargo(s)</th>
                      <th className="border-b border-white/10 px-2 py-2">Grau</th>
                      {showContacts ? <th className="border-b border-white/10 px-2 py-2">Contato</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td className="border-b border-white/5 px-2 py-2.5 align-top">
                          <div className="flex items-center gap-3">
                            {m.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.photoUrl} alt="" className="comp-noprint h-9 w-9 rounded-full border border-white/8 object-cover" />
                            ) : (
                              <span className="comp-noprint flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/15 text-sand-dark/50">
                                <UserRound className="h-4 w-4" />
                              </span>
                            )}
                            <div>
                              <p className="font-medium text-sand-light">{m.name}</p>
                              {showContacts && m.status !== 'active' ? <p className="text-xs text-amber-300">{memberStatusLabel(m.status)}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-white/5 px-2 py-2.5 align-top text-gold">
                          {m.offices.map((o) => o.name).join(' · ')}
                        </td>
                        <td className="border-b border-white/5 px-2 py-2.5 align-top text-sand">{m.degree}</td>
                        {showContacts ? (
                          <td className="border-b border-white/5 px-2 py-2.5 align-top text-xs text-sand-dark">
                            {m.phone ? <p>{m.phone}</p> : null}
                            {m.email ? <p>{m.email}</p> : null}
                            {!m.phone && !m.email ? '—' : null}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {term && vacant.length > 0 ? (
          <div className="comp-noprint">
            <CollapsibleCard title="Cargos sem titular neste período" count={vacant.length} defaultOpen={false}>
              <p className="mb-3 text-xs text-sand-dark">Cargos cadastrados na loja que ainda não têm obreiro vinculado no período selecionado.</p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {vacant.map((o) => (
                  <li key={o.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-3 py-2 text-sm text-sand">
                    {o.name}
                    {o.riteName ? <span className="ml-2 text-xs text-sand-dark">{o.riteName}</span> : null}
                  </li>
                ))}
              </ul>
            </CollapsibleCard>
          </div>
        ) : null}
      </div>
    </main>
  );
}
