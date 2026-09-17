'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { symbolicSituation, type SymbolicSituation } from '@/lib/masonic-degree';
import { memberStatusLabel, MEMBER_STATUSES } from '@/lib/member-status';

interface MemberInput {
  id: string;
  name: string;
  status: string;
  initiationDate: string | null;
  elevationDate: string | null;
  exaltationDate: string | null;
  installationDate: string | null;
  origin: 'local' | 'affiliated' | 'unknown';
}

const ORIGIN_LABEL: Record<MemberInput['origin'], string> = {
  local: 'Iniciado nesta loja',
  affiliated: 'Filiado',
  unknown: 'Sem origem cadastrada',
};

const DEGREE_ORDER: (SymbolicSituation | 'sem-grau')[] = ['Mestre Instalado', 'Mestre', 'Companheiro', 'Aprendiz', 'sem-grau'];
const DEGREE_LABEL: Record<string, string> = { 'sem-grau': 'Sem grau registrado' };

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 16mm 14mm; }
  body * { visibility: hidden !important; }
  .qs-print, .qs-print * { visibility: visible !important; }
  .qs-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 9.5pt; }
  .qs-noprint { display: none !important; }
  .qs-print h1, .qs-print h2, .qs-print h3 { color: #111 !important; }
  .qs-print table { width: 100%; border-collapse: collapse; }
  .qs-print th, .qs-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; text-align: left; }
  .qs-print th { text-transform: uppercase; font-size: 8pt; border-bottom: 1.5px solid #333; }
  .qs-print .num { text-align: right; }
  .qs-print tr { break-inside: avoid; page-break-inside: avoid; }
  .qs-print .pagebreak { break-before: page; page-break-before: always; }
}
`;

export default function QuadroSocialClient({ lodgeName, crestUrl, members }: { lodgeName: string; crestUrl: string | null; members: MemberInput[] }) {
  const [includeAll, setIncludeAll] = useState(false);

  const visible = includeAll ? members : members.filter((m) => m.status === 'active');

  const byDegree = useMemo(() => {
    const groups = new Map<string, MemberInput[]>();
    for (const key of DEGREE_ORDER) groups.set(key, []);
    for (const m of visible) {
      const sit = symbolicSituation(m) ?? 'sem-grau';
      groups.get(sit)!.push(m);
    }
    return DEGREE_ORDER.map((key) => ({ key, label: DEGREE_LABEL[key] ?? key, members: groups.get(key) ?? [] }));
  }, [visible]);

  const byStatus = useMemo(() => {
    return MEMBER_STATUSES.map((s) => ({ status: s.value, label: s.short, count: members.filter((m) => m.status === s.value).length }))
      .filter((s) => s.count > 0);
  }, [members]);

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="qs-noprint">
          <Link href="/dashboard/membros" className="text-xs text-gold/70 transition hover:text-gold">&larr; Voltar a Membros</Link>
          <h1 className="mt-2 font-display text-2xl font-bold text-sand-light">Quadro social</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Fotografia atual do quadro por grau simbólico — formato pensado pra prestação de contas à Potência.
          </p>
          <p className="mt-1 text-xs text-sand-dark">
            Mostra a situação de hoje, não um histórico de admissões/desligamentos no ano (o sistema não guarda a data
            de cada mudança de situação).
          </p>
        </div>

        <label className="qs-noprint flex w-fit items-center gap-2 text-sm text-sand-dark">
          <input type="checkbox" checked={includeAll} onChange={(e) => setIncludeAll(e.target.checked)} />
          Incluir afastados/suspensos/inativos (não só ativos)
        </label>

        {members.length === 0 ? (
          <EmptyState title="Nenhum membro cadastrado ainda." description="Cadastre membros em Membros para ver o quadro social." />
        ) : (
          <>
            <div className="qs-noprint">
              <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
                Salvar como PDF
              </button>
            </div>

            <section className="rounded-xl border border-white/6 bg-sigma-card p-6 qs-print">
              <header className="mb-5 text-center">
                {crestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
                ) : null}
                <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
                <h2 className="mt-0.5 text-sm text-sand-dark">Quadro social {includeAll ? '— todos os status' : '— membros ativos'}</h2>
                <p className="mt-0.5 text-xs text-sand-dark">Emitido em {new Date().toLocaleDateString('pt-BR')} · {visible.length} membro(s)</p>
              </header>

              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {byDegree.map((g) => (
                  <div key={g.key} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                    <p className="text-xs text-sand-dark">{g.label}</p>
                    <p className="mt-2 text-xl font-semibold text-sand-light">{g.members.length}</p>
                  </div>
                ))}
              </div>

              {byDegree.map((g) => g.members.length > 0 ? (
                <div key={g.key} className="mb-6">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-sand-light">{g.label} ({g.members.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                          <th className="border-b border-white/10 px-2 py-2">Nome</th>
                          <th className="border-b border-white/10 px-2 py-2">Situação</th>
                          <th className="border-b border-white/10 px-2 py-2">Origem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.members.map((m) => (
                          <tr key={m.id}>
                            <td className="border-b border-white/5 px-2 py-2 text-sand-light">{m.name}</td>
                            <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{memberStatusLabel(m.status)}</td>
                            <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{ORIGIN_LABEL[m.origin]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null)}

              <div className="pagebreak" />
              <h3 className="mb-2 mt-2 text-sm font-semibold uppercase tracking-wide text-sand-light">Resumo por situação</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                      <th className="border-b border-white/10 px-2 py-2">Situação</th>
                      <th className="border-b border-white/10 px-2 py-2 text-right num">Membros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byStatus.map((s) => (
                      <tr key={s.status}>
                        <td className="border-b border-white/5 px-2 py-2 text-sand-light">{s.label}</td>
                        <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-sand">{s.count}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-2 py-2 font-semibold text-sand-light">Total</td>
                      <td className="px-2 py-2 text-right num font-semibold text-gold">{members.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
