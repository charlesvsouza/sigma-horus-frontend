'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OfficialDocument } from '@/components/report/official-document';
import { ReportActions, type Signatory } from '@/components/report/report-document';
import { Button, Toast, useConfirm, type ToastMessage } from '@/components/ui';
import { partyLabel } from '@/lib/agreement-signature';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import type { Letterhead } from '@/lib/letterhead';

interface Party { party: string; label: string; name: string | null; signedAt: string | null; code: string | null }

const KIND: Record<string, string> = { debt: 'Dívida', fee: 'Taxa de regularização', extra: 'Multa e juros' };
const stamp = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function TermoAcordoClient({
  letterhead, memberId, memberName, status, blockedAt, powerProtocol, powerSentAt, total, installments, items, schedule, parties, canSignAs, issuedBy,
}: {
  letterhead: Letterhead;
  memberId: string;
  memberName: string;
  status: string;
  blockedAt: string;
  powerProtocol: string | null;
  powerSentAt: string | null;
  total: number;
  installments: number;
  items: { id: string; kind: string; title: string; openAmount: number }[];
  schedule: { number: number; dueDate: string; amount: number }[];
  parties: Party[];
  canSignAs: string | null;
  issuedBy: string | null;
}) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ToastMessage>(null);
  const signed = parties.filter((p) => p.signedAt).length;

  async function sign() {
    if (!(await askConfirm({
      title: 'Assinar o termo de acordo',
      message: `Você assina digitalmente este termo como ${partyLabel(canSignAs ?? '')}. A assinatura registra quem assinou, quando e o resumo do acordo, e não pode ser desfeita.`,
      confirmLabel: 'Assinar digitalmente',
    }))) return;
    setBusy(true);
    const res = await fetch(`/api/members/${memberId}/block/sign`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMessage({ kind: 'ok', text: `Assinado digitalmente. Código de verificação: ${data.code}.` });
      router.refresh();
    } else setMessage({ kind: 'error', text: data.error ?? 'Não foi possível assinar.' });
  }

  const signatures: Signatory[] = parties.map((p) => ({
    role: p.label,
    name: p.name,
    mark: p.signedAt && p.code ? `Assinado digitalmente em ${stamp(p.signedAt)} · ${p.code}` : null,
  }));

  return (
    <main className="min-h-screen px-6 py-10">
      <Toast message={message} onClose={() => setMessage(null)} />
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="rpt-noprint flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-sand-dark">Assinaturas digitais: <strong className="text-sand-light">{signed} de {parties.length}</strong></p>
          <div className="flex flex-wrap items-center gap-3">
            {canSignAs ? (
              <Button type="button" onClick={() => void sign()} disabled={busy}>
                {busy ? 'Assinando…' : `Assinar digitalmente como ${partyLabel(canSignAs)}`}
              </Button>
            ) : null}
            <ReportActions />
          </div>
        </div>
        {status === 'lifted' ? <p className="rpt-noprint text-sm text-sand-dark">Acordo encerrado: o irmão já foi liberado.</p> : null}

        <OfficialDocument
          letterhead={letterhead}
          title="Termo de acordo de regularização"
          subtitle={`Art. 002 — ${installments === 1 ? 'pagamento à vista' : `pagamento em ${installments} parcelas`}`}
          issuedBy={issuedBy}
          signatures={signatures}
        >
          <div className="space-y-4 text-[0.95rem] leading-relaxed text-sand">
            <p className="indent-8">
              Pelo presente termo, o Ir∴ <strong>{memberName}</strong>, doravante IRMÃO, e a <strong>{letterhead.name}</strong>, por seus representantes abaixo
              assinados, reconhecem as pendências financeiras do IRMÃO junto à Loja e ajustam a sua regularização, em decorrência do comunicado à Potência
              {powerSentAt ? <> feito em <strong>{formatDateOnly(powerSentAt)}</strong></> : null}
              {powerProtocol ? <> (protocolo <strong>{powerProtocol}</strong>)</> : null}, com bloqueio do cadastro em <strong>{formatDateOnly(blockedAt)}</strong>.
            </p>
            <table className="w-full border-collapse text-sm [&_td]:px-3 [&_td]:py-1.5 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th.num]:text-right [&_td.num]:text-right [&_th]:border-b [&_th]:border-white/10">
              <thead><tr><th>Natureza</th><th>Descrição</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}><td>{KIND[i.kind] ?? i.kind}</td><td>{i.kind === 'debt' ? i.title : 'Art. 002'}</td><td className="num">{brl(i.openAmount)}</td></tr>
                ))}
                <tr className="rpt-total"><td colSpan={2}>Total do acordo</td><td className="num">{brl(total)}</td></tr>
              </tbody>
            </table>
            <table className="w-full border-collapse text-sm [&_td]:px-3 [&_td]:py-1.5 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th.num]:text-right [&_td.num]:text-right [&_th]:border-b [&_th]:border-white/10">
              <thead><tr><th>{installments === 1 ? 'Pagamento' : 'Parcela'}</th><th>Vencimento</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {schedule.map((p) => (
                  <tr key={p.number}><td>{installments === 1 ? 'Única' : `${p.number}/${installments}`}</td><td>{formatDateOnly(p.dueDate)}</td><td className="num">{brl(p.amount)}</td></tr>
                ))}
              </tbody>
            </table>
            <ol className="list-decimal space-y-2 pl-6">
              <li>O valor do acordo fica <strong>fixado na data do bloqueio</strong> e compreende todas as dívidas do IRMÃO com a Loja então em aberto, vencidas ou a vencer, mais a taxa de regularização e, quando houver, multa e juros. Não há desconto.</li>
              <li>O pagamento é feito à vista ou, quando ajustado, nas parcelas acima, até o limite de três. O que for pago é aplicado primeiro à taxa de regularização e, depois, às dívidas, da mais antiga para a mais nova.</li>
              <li>Enquanto o acordo não estiver <strong>integralmente pago</strong>, o cadastro do IRMÃO permanece bloqueado: ele não é convocado para as sessões e não recebe novos débitos.</li>
              <li>O atraso de qualquer parcela caracteriza o descumprimento do acordo. O Tesoureiro, o Venerável Mestre e os Administradores serão avisados para as medidas cabíveis, mantendo-se o bloqueio.</li>
              <li>Quitado o acordo, o Venerável Mestre libera o cadastro do IRMÃO, que volta a ser convocado, e a mensalidade recomeça no próximo vencimento.</li>
              <li>As assinaturas digitais deste termo registram quem assinou, quando e o resumo criptográfico (hash) do que foi acordado; qualquer alteração posterior do acordo pode ser detectada pelo código de verificação impresso em cada assinatura.</li>
            </ol>
          </div>
        </OfficialDocument>
      </div>
    </main>
  );
}
