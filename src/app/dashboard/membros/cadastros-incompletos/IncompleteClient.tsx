'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fetchRecordShare, WhatsAppSendDialog, type WhatsAppShare } from '@/components/whatsapp-send-dialog';
import { Alert, EmptyState } from '@/components/ui';
import { ReportActions, ReportDocument, type Signatory } from '@/components/report/report-document';

interface Row { id: string; name: string; noCpf: boolean; noEmail: boolean; noBirth: boolean; phone: string | null }

export default function IncompleteClient({ lodgeName, crestUrl, issuedBy, signatures, total, rows }: { lodgeName: string; crestUrl: string | null; issuedBy?: string | null; signatures: Signatory[]; total: number; rows: Row[] }) {
  const [share, setShare] = useState<WhatsAppShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  async function notify() {
    setError(null);
    setNotice(null);
    setSending(true);
    const res = await fetch('/api/members/incomplete/notify', { method: 'POST' }).catch(() => null);
    setSending(false);
    const data = await res?.json().catch(() => ({}));
    if (!res || !res.ok) { setError(data?.error ?? 'Não foi possível enviar os avisos.'); return; }
    setNotice(`${data.membersEmailed} irmão(s) avisado(s) por e-mail${data.membersSkipped ? ` (${data.membersSkipped} sem e-mail ou avisados há menos de 7 dias)` : ''}; resumo enviado a ${data.secretaryEmailed} Secretário(s).`);
  }
  async function ask(id: string) {
    setError(null);
    const r = await fetchRecordShare(id);
    if (r.ok) setShare(r.share); else setError(r.error);
  }
  const noCpf = rows.filter((r) => r.noCpf).length;
  const noEmail = rows.filter((r) => r.noEmail).length;
  const noBirth = rows.filter((r) => r.noBirth).length;
  const mark = (missing: boolean) => (missing ? 'FALTA' : 'ok');

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rpt-noprint">
          <Link href="/dashboard/membros" className="px-1 py-1 text-xs text-gold transition hover:text-gold-light">&larr; Voltar a Membros</Link>
          <h1 className="mt-2 font-display text-2xl font-bold text-sand-light">Cadastros incompletos</h1>
          <p className="mt-1 text-sm text-sand-dark">Irmãos ativos sem CPF, e-mail ou data de nascimento.</p>
        </div>

        <Alert intent="warn" className="rpt-noprint">
          <strong>Providência urgente.</strong> O e-mail é por onde saem as cobranças, os lembretes e as convocações, o CPF é exigido para emitir cobrança pelo Asaas e a data de nascimento alimenta aniversários, o benefício por idade e o quadro da loja. Sem eles o irmão não recebe e a Tesouraria não consegue cobrar. Imprima a lista, colete os dados com cada irmão e atualize o cadastro em Membros.
        </Alert>
        {error ? <Alert intent="danger" className="rpt-noprint">{error}</Alert> : null}
        {notice ? <Alert intent="ok" className="rpt-noprint">{notice}</Alert> : null}

        {rows.length === 0 ? (
          <EmptyState title="Nenhum cadastro pendente." description={`Os ${total} irmãos ativos têm CPF e e-mail.`} />
        ) : (
          <>
            <div className="rpt-noprint"><button type="button" onClick={() => void notify()} disabled={sending} className="rounded-full border border-gold/40 px-4 py-2 text-xs font-medium text-gold transition hover:border-gold/70 disabled:opacity-50">{sending ? 'Enviando…' : 'Avisar por e-mail (irmãos e Secretário)'}</button></div>
            <ReportActions csv={() => ({ filename: `cadastros_incompletos_${new Date().toISOString().slice(0, 10)}`, rows: [['Nome', 'CPF', 'E-mail', 'Nascimento', 'Telefone'], ...rows.map((r) => [r.name, mark(r.noCpf), mark(r.noEmail), mark(r.noBirth), r.phone ?? ''])] })} />
            <ReportDocument
              lodgeName={lodgeName}
              crestUrl={crestUrl}
              title="Cadastros incompletos (CPF, e-mail ou nascimento)"
              details={[`${rows.length} de ${total} irmãos ativos`, `${noCpf} sem CPF`, `${noEmail} sem e-mail`, `${noBirth} sem data de nascimento`]}
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
                      <th className="border-b border-white/10 px-2 py-2">Nascimento</th>
                      <th className="border-b border-white/10 px-2 py-2">Telefone (para contato)</th>
                      <th className="rpt-noprint border-b border-white/10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="border-b border-white/5 px-2 py-2 text-sand-light">{r.name}</td>
                        <td className={`border-b border-white/5 px-2 py-2 ${r.noCpf ? 'font-semibold text-rose-300' : 'text-sand-dark'}`}>{mark(r.noCpf)}</td>
                        <td className={`border-b border-white/5 px-2 py-2 ${r.noEmail ? 'font-semibold text-rose-300' : 'text-sand-dark'}`}>{mark(r.noEmail)}</td>
                        <td className={`border-b border-white/5 px-2 py-2 ${r.noBirth ? 'font-semibold text-rose-300' : 'text-sand-dark'}`}>{mark(r.noBirth)}</td>
                        <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{r.phone ?? '—'}</td>
                        <td className="rpt-noprint border-b border-white/5 px-2 py-2 text-right"><button type="button" onClick={() => void ask(r.id)} className="rounded-full border border-amber-500/40 px-3 py-1 text-xs text-amber-300 hover:border-amber-500/60">Pedir pelo WhatsApp</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportDocument>
          </>
        )}
      </div>
      {share ? <WhatsAppSendDialog key={share.key} share={share} onClose={() => setShare(null)} /> : null}
    </main>
  );
}
