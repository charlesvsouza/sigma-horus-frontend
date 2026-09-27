'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Badge, inputClass } from '@/components/ui';
import { ReportActions, type Signatory } from '@/components/report/report-document';
import { OfficialDocument } from '@/components/report/official-document';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import type { GoodStanding } from '@/lib/good-standing';
import type { Letterhead } from '@/lib/letterhead';

// Declaração de regularidade financeira — a loja emite para qualquer irmão (Tesoureiro,
// Administrador, Venerável); o irmão emite a própria no portal. Só sai o documento quando
// não há nada vencido: com pendência, a tela mostra o que falta regularizar.

export interface DeclarationMember {
  id: string;
  name: string;
  cpf: string | null;
  degree: string;
}

export default function DeclaracaoClient({
  mode,
  letterhead,
  members = [],
  member,
  standing,
  signatures,
  number,
  issuedBy,
}: {
  mode: 'staff' | 'member';
  letterhead: Letterhead;
  members?: { id: string; name: string }[];
  member: DeclarationMember | null;
  standing: GoodStanding | null;
  signatures: Signatory[];
  number: string | null;
  issuedBy?: string | null;
}) {
  const router = useRouter();
  const staff = mode === 'staff';

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rpt-noprint">
          {!staff ? <Link href="/dashboard/portal" className="text-xs text-gold hover:text-gold-light">← Voltar ao meu portal</Link> : null}
          <h1 className="mt-1 font-display text-2xl font-bold text-sand-light">Declaração de regularidade financeira</h1>
          <p className="mt-1 text-sm text-sand-dark">
            {staff
              ? 'Emita a declaração de que o irmão não tem débitos vencidos com a loja — para transferência, elevação, filiação ou candidatura.'
              : 'Emita a declaração de que você está em dia com a Tesouraria. Ela só sai quando não há nada vencido.'}
          </p>
        </div>

        {staff ? (
          <section className="rpt-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
            <label className="block text-xs text-sand-dark">Irmão
              <select
                value={member?.id ?? ''}
                onChange={(e) => router.push(`/dashboard/relatorios/declaracao-regularidade${e.target.value ? `?memberId=${e.target.value}` : ''}`)}
                className={`mt-1 ${inputClass}`}
              >
                <option value="">Selecione o irmão…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </section>
        ) : null}

        {member && standing ? (
          standing.regular ? (
            <>
              <div className="rpt-noprint flex flex-wrap items-center justify-between gap-3">
                <Badge variant="paid" dot>Em dia com a Tesouraria</Badge>
                <ReportActions />
              </div>
              {staff && standing.upcomingTotal > 0 ? (
                <p className="rpt-noprint text-xs text-sand-dark">
                  Há {brl(standing.upcomingTotal)} a vencer — não impede a declaração, que se refere a débitos vencidos.
                </p>
              ) : null}
              <OfficialDocument
                letterhead={letterhead}
                title="Declaração de regularidade financeira"
                subtitle={number ? `Nº ${number}` : null}
                issuedBy={issuedBy}
                signatures={signatures}
              >
                <div className="space-y-4 text-[0.95rem] leading-relaxed text-sand">
                  <p className="indent-8">
                    Declaramos, para os devidos fins, que o Ir∴ <strong>{member.name}</strong>
                    {member.cpf ? <>, CPF {member.cpf}</> : null}
                    {member.degree && member.degree !== '—' ? <>, {member.degree}</> : null}, obreiro desta Loja,
                    encontra-se em <strong>situação financeira regular</strong> perante a sua Tesouraria, não constando
                    débitos vencidos em seu nome até a presente data.
                  </p>
                  <p className="indent-8">
                    Esta declaração refere-se exclusivamente às obrigações financeiras com a Loja e é válida por 30 (trinta)
                    dias a contar da data de emissão.
                  </p>
                </div>
              </OfficialDocument>
            </>
          ) : (
            <section className="rpt-noprint space-y-4 rounded-xl border border-rose-500/25 bg-rose-500/5 p-6">
              <Alert intent="danger">
                {staff ? `${member.name} tem` : 'Você tem'} {standing.overdue.length} débito{standing.overdue.length !== 1 ? 's' : ''} vencido{standing.overdue.length !== 1 ? 's' : ''}, no total de{' '}
                <strong>{brl(standing.overdueTotal)}</strong>. A declaração sai depois que {staff ? 'eles forem regularizados' : 'você regularizar'}.
              </Alert>
              <ul className="space-y-2 text-sm">
                {standing.overdue.map((o, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-3">
                    <span className="text-sand-light">{o.title} <span className="text-xs text-sand-dark">· venceu em {formatDateOnly(o.dueDate)} ({o.days} dia{o.days !== 1 ? 's' : ''})</span></span>
                    <span className="font-semibold tabular-nums text-sand-light">{brl(o.balance)}</span>
                  </li>
                ))}
              </ul>
              {!staff ? (
                <Link href="/dashboard/portal" className="inline-flex text-sm font-medium text-gold hover:text-gold-light">Pagar pelas Minhas pendências →</Link>
              ) : null}
            </section>
          )
        ) : staff ? (
          <p className="rpt-noprint text-sm text-sand-dark">Escolha o irmão para ver a situação e emitir a declaração.</p>
        ) : null}
      </div>
    </main>
  );
}
