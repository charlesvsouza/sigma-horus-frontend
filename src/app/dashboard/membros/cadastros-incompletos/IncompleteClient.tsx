'use client';

import Link from 'next/link';
import { Alert, EmptyState } from '@/components/ui';
import { ReportActions, ReportDocument, type Signatory } from '@/components/report/report-document';

interface Row { id: string; name: string; noCpf: boolean; noEmail: boolean; phone: string | null }

export default function IncompleteClient({ lodgeName, crestUrl, issuedBy, signatures, total, rows }: { lodgeName: string; crestUrl: string | null; issuedBy?: string | null; signatures: Signatory[]; total: number; rows: Row[] }) {
  const noCpf = rows.filter((r) => r.noCpf).length;
  const noEmail = rows.filter((r) => r.noEmail).length;
  const mark = (missing: boolean) => (missing ? 'FALTA' : 'ok');

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rpt-noprint">
          <Link href="/dashboard/membros" className="px-1 py-1 text-xs text-gold transition hover:text-gold-light">&larr; Voltar a Membros</Link>
          <h1 className="mt-2 font-display text-2xl font-bold text-sand-light">Cadastros incompletos</h1>
          <p className="mt-1 text-sm text-sand-dark">Irmãos ativos sem CPF ou sem e-mail.</p>
        </div>

        <Alert intent="warn" className="rpt-noprint">
          <strong>Providência urgente.</strong> O e-mail é por onde saem as cobranças, os lembretes e as convocações, e o CPF é exigido para emitir cobrança pelo Asaas. Sem eles o irmão não recebe e a Tesouraria não consegue cobrar. Imprima a lista, colete os dados com cada irmão e atualize o cadastro em Membros.
        </Alert>

        {rows.length === 0 ? (
          <EmptyState title="Nenhum cadastro pendente." description={`Os ${total} irmãos ativos têm CPF e e-mail.`} />
        ) : (
          <>
            <ReportActions csv={() => ({ filename: `cadastros_incompletos_${new Date().toISOString().slice(0, 10)}`, rows: [['Nome', 'CPF', 'E-mail', 'Telefone'], ...rows.map((r) => [r.name, mark(r.noCpf), mark(r.noEmail), r.phone ?? ''])] })} />
            <ReportDocument
              lodgeName={lodgeName}
              crestUrl={crestUrl}
              title="Cadastros incompletos (sem CPF ou e-mail)"
              details={[`${rows.length} de ${total} irmãos ativos`, `${noCpf} sem CPF`, `${noEmail} sem e-mail`]}
              issuedBy={issuedBy}
              signatures={signatures}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                      <th className="border-b border-white/10 px-2 py-2">Nome</th>
                      <th className="border-b border-white/10 px-2 py-2">CPF</th>
                      <th className="border-b border-white/10 px-2 py-2">E-mail</th>
                      <th className="border-b border-white/10 px-2 py-2">Telefone (para contato)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="border-b border-white/5 px-2 py-2 text-sand-light">{r.name}</td>
                        <td className={`border-b border-white/5 px-2 py-2 ${r.noCpf ? 'font-semibold text-rose-300' : 'text-sand-dark'}`}>{mark(r.noCpf)}</td>
                        <td className={`border-b border-white/5 px-2 py-2 ${r.noEmail ? 'font-semibold text-rose-300' : 'text-sand-dark'}`}>{mark(r.noEmail)}</td>
                        <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{r.phone ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportDocument>
          </>
        )}
      </div>
    </main>
  );
}
