'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { ReportActions, ReportDocument, type Signatory } from '@/components/report/report-document';
import { symbolicSituation, type SymbolicSituation } from '@/lib/masonic-degree';
import { memberStatusLabel, MEMBER_STATUSES } from '@/lib/member-status';

interface MemberInput {
  id: string;
  name: string;
  status: string;
  photoUrl: string | null;
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

export default function QuadroSocialClient({ lodgeName, crestUrl, issuedBy, signatures, members, canSeeAllStatuses = true }: { lodgeName: string; crestUrl: string | null; issuedBy?: string | null; signatures: Signatory[]; members: MemberInput[]; canSeeAllStatuses?: boolean }) {
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

  function csvRows(): unknown[][] {
    return [
      ['Grau', 'Nome', 'Situação', 'Origem'],
      ...byDegree.flatMap((g) => g.members.map((m) => [g.label, m.name, memberStatusLabel(m.status), ORIGIN_LABEL[m.origin]])),
    ];
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rpt-noprint">
          <Link href="/dashboard/membros" className="text-xs px-1 py-1 text-gold transition hover:text-gold-light">&larr; Voltar a Membros</Link>
          <h1 className="mt-2 font-display text-2xl font-bold text-sand-light">Quadro social</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Fotografia atual do quadro por grau simbólico — formato pensado pra prestação de contas à Potência.
          </p>
          <p className="mt-1 text-xs text-sand-dark">
            Mostra a situação de hoje, não um histórico de admissões/desligamentos no ano (o sistema não guarda a data
            de cada mudança de situação).
          </p>
        </div>

        {canSeeAllStatuses ? (
          <label className="rpt-noprint flex w-fit items-center gap-2 text-sm text-sand-dark">
            <input type="checkbox" checked={includeAll} onChange={(e) => setIncludeAll(e.target.checked)} />
            Incluir afastados/suspensos/inativos (não só ativos)
          </label>
        ) : null}

        {members.length === 0 ? (
          <EmptyState title="Nenhum membro cadastrado ainda." description="Cadastre membros em Membros para ver o quadro social." />
        ) : (
          <>
            <ReportActions csv={() => ({ filename: `quadro_social_${new Date().toISOString().slice(0, 10)}`, rows: csvRows() })} />

            <ReportDocument
              lodgeName={lodgeName}
              crestUrl={crestUrl}
              title={`Quadro social ${includeAll ? '— todas as situações' : '— membros ativos'}`}
              details={[`${visible.length} membro(s)`, 'posição na data de emissão']}
              issuedBy={issuedBy}
              signatures={signatures}
            >
              <div className="rpt-section mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {byDegree.map((g) => (
                  <div key={g.key} className="rpt-card rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
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
                          <th className="border-b border-white/10 px-2 py-2">Foto</th>
                          <th className="border-b border-white/10 px-2 py-2">Nome</th>
                          <th className="border-b border-white/10 px-2 py-2">Situação</th>
                          <th className="border-b border-white/10 px-2 py-2">Origem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.members.map((m) => (
                          <tr key={m.id}>
                            <td className="border-b border-white/5 px-2 py-2">
                              {m.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.photoUrl} alt="" className="h-8 w-8 rounded-full border border-white/8 object-cover" />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-white/15 text-sand-dark/50">
                                  <UserRound className="h-4 w-4" />
                                </div>
                              )}
                            </td>
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

              <div className="rpt-pagebreak" />
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
                    <tr className="rpt-total">
                      <td className="px-2 py-2 font-semibold text-sand-light">Total</td>
                      <td className="px-2 py-2 text-right num font-semibold text-gold">{members.length}</td>
                    </tr>
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
