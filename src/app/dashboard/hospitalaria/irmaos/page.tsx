'use client';

import { useEffect, useMemo, useState } from 'react';
import { EmptyState, Skeleton, inputClass } from '@/components/ui';
import { degreeShort } from '@/lib/masonic-degree';

type RelativeKind = 'mother' | 'father' | 'spouse' | 'son' | 'daughter' | 'child' | 'other';
interface Relative { id?: string; kind: RelativeKind; name: string; birthDate?: string | null; phone?: string | null; email?: string | null; }
interface Member {
  id: string; name: string; email?: string | null; phone?: string | null; status: string;
  cpf?: string | null; masonicNumber?: string | null; currentDegree?: string | null; gradeName?: string | null;
  initiationDate?: string | null; elevationDate?: string | null; exaltationDate?: string | null; installationDate?: string | null;
  relatives?: Relative[];
}

const KIND_LABEL: Record<string, string> = { mother: 'Mãe', father: 'Pai', spouse: 'Esposa', son: 'Filho', daughter: 'Filha', child: 'Filho(a)', other: 'Dependente' };
const STATUS: Record<string, string> = { active: 'Ativo', quit_placet: 'Quit Placet', placet_ex_officio: 'Placet Ex Officio', art_002: 'Art. 002', suspended: 'Suspenso', inactive: 'Inativo' };

export default function IrmaosConsultaPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/members').then((r) => r.json()).then((d) => { setMembers(d.items ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q) || (m.phone ?? '').includes(q) || (m.email ?? '').toLowerCase().includes(q));
  }, [members, query]);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Irmãos — consulta</h1>
          <p className="mt-1 text-sm text-sand-dark">Contatos dos obreiros e seus familiares para o acompanhamento da Hospitalaria. Somente leitura.</p>
        </div>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-sand-light">Obreiros</h2>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} w-auto min-w-[16rem]`} placeholder="Buscar por nome, telefone ou e-mail…" />
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-white/[6%]">
            {loading ? (
              <div className="divide-y divide-white/[5%]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3.5"><Skeleton variant="text" className="w-1/3" /><Skeleton variant="text" className="ml-auto w-28" /></div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState title="Nenhum irmão encontrado" description="Ajuste a busca ou aguarde o cadastro dos obreiros pela Secretaria." />
            ) : (
              filtered.map((m) => {
                const open = openId === m.id;
                return (
                  <div key={m.id} className="border-b border-white/[5%] last:border-b-0">
                    <button onClick={() => setOpenId(open ? null : m.id)} className="grid w-full grid-cols-1 gap-1 px-4 py-3 text-left transition-colors hover:bg-sigma-blue-deep/40 md:grid-cols-[1.6fr_0.8fr_1fr_1.2fr] md:items-center md:gap-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-sand-light"><span className={`text-gold transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>{m.name}</span>
                      <span className="text-xs text-sand-dark md:text-sm">{degreeShort(m)}</span>
                      <span className="text-xs text-sand-dark md:text-sm">{m.phone || '—'}</span>
                      <span className="truncate text-xs text-sand-dark md:text-sm">{m.email || '—'}</span>
                    </button>
                    {open ? (
                      <div className="border-t border-white/[5%] bg-sigma-blue-deep/30 px-4 py-4 text-sm">
                        <div className="grid gap-2 md:grid-cols-3">
                          <p className="text-sand-dark"><span className="text-[11px] uppercase tracking-wide text-sand-dark/70">Situação:</span> <span className="text-sand">{STATUS[m.status] ?? m.status}</span></p>
                          <p className="text-sand-dark"><span className="text-[11px] uppercase tracking-wide text-sand-dark/70">CIM:</span> <span className="text-sand">{m.masonicNumber || '—'}</span></p>
                          <p className="text-sand-dark"><span className="text-[11px] uppercase tracking-wide text-sand-dark/70">CPF:</span> <span className="text-sand">{m.cpf || '—'}</span></p>
                        </div>
                        {m.relatives && m.relatives.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">Família (contatos)</p>
                            <ul className="mt-1 space-y-0.5 text-sand">
                              {m.relatives.map((r, i) => (
                                <li key={r.id ?? i}><span className="text-sand-dark">{KIND_LABEL[r.kind] ?? r.kind}:</span> {r.name}{r.phone ? ` · ${r.phone}` : ''}{r.email ? ` · ${r.email}` : ''}</li>
                              ))}
                            </ul>
                          </div>
                        ) : <p className="mt-3 text-xs text-sand-dark/70">Sem familiares cadastrados.</p>}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
