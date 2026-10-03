'use client';

import { OfficialDocument } from '@/components/report/official-document';
import { ReportActions, type Signatory } from '@/components/report/report-document';
import type { PresentedPlan } from '@/lib/degree-fee-server';
import type { Letterhead } from '@/lib/letterhead';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { maskCPF } from '@/lib/masks';

export default function ContratoClient({
  plan, memberCpf, isCandidate, letterhead, signatures, issuedBy,
}: {
  plan: PresentedPlan;
  memberCpf: string | null;
  isCandidate: boolean;
  letterhead: Letterhead;
  signatures: Signatory[];
  issuedBy: string | null;
}) {
  const who = isCandidate ? 'o Sr.' : 'o Ir∴';
  const party = isCandidate ? 'CANDIDATO' : 'IRMÃO';
  const n = plan.cotaCount; // cotas do plano, entrada incluída
  const down = plan.downPayment;
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="rpt-noprint flex justify-end"><ReportActions /></div>
        {plan.status === 'canceled' ? (
          <p className="rpt-noprint text-sm text-rose-300">Plano cancelado em {formatDateOnly(plan.canceledAt)} — {plan.cancelReason}</p>
        ) : null}
        <OfficialDocument
          letterhead={letterhead}
          title={`Termo de compromisso — ${plan.label}`}
          subtitle={`Plano de pagamento ${n === 1 ? 'à vista' : down ? `com entrada e ${plan.installments} parcelas` : `em ${n} cotas`}`}
          issuedBy={issuedBy}
          signatures={[...signatures, { role: isCandidate ? 'Candidato' : 'Irmão contratante', name: plan.member.name }]}
        >
          <div className="space-y-4 text-[0.95rem] leading-relaxed text-sand">
            <p className="indent-8">
              Pelo presente termo, {who} <strong>{plan.member.name}</strong>{memberCpf ? <>, CPF {maskCPF(memberCpf)}</> : null}, doravante {party},
              compromete-se a pagar à <strong>{letterhead.name}</strong> a <strong>{plan.label.toLowerCase()}</strong> no valor total de{' '}
              <strong>{brl(plan.totalAmount)}</strong>, {n === 1 ? 'à vista' : down ? <>com <strong>entrada de {brl(down)}</strong> e o saldo em <strong>{plan.installments} parcelas</strong> mensais</> : <>em <strong>{n} cotas</strong> mensais</>}, conforme o quadro abaixo.
            </p>
            {plan.paymentMethod === 'card' ? (
              <p className="indent-8">
                O pagamento será feito no <strong>cartão de crédito</strong>, pela plataforma de cobrança da Loja (Asaas), em {n}x. A tarifa do cartão é
                repassada ao {party.toLowerCase()}: ao valor da taxa somam-se <strong>{brl(plan.cardSurcharge ?? 0)}</strong>, totalizando{' '}
                <strong>{brl(plan.totalAmount + (plan.cardSurcharge ?? 0))}</strong>. Por Pix ou boleto, não haveria acréscimo.
              </p>
            ) : null}
            <table>
              <thead><tr><th>Cota</th><th>Vencimento</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {plan.cotas.map((c, i) => (
                  <tr key={c.id}><td>{n === 1 ? 'Única' : down && i === 0 ? 'Entrada' : `${i + 1}/${n}`}</td><td>{formatDateOnly(c.dueDate)}</td><td className="num">{brl(c.amount)}</td></tr>
                ))}
                <tr className="rpt-total"><td colSpan={2}>Total</td><td className="num">{brl(plan.cotas.reduce((sum, c) => sum + c.amount, 0))}</td></tr>
              </tbody>
            </table>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                O valor acima fica <strong>fixado na data deste termo</strong> ({formatDateOnly(plan.createdAt)}). Reajuste posterior da taxa pela Loja
                não gera cobrança de diferença.
              </li>
              <li>
                A taxa deverá estar <strong>integralmente quitada até a data da {plan.event}</strong>, ainda que essa data venha a ser definida depois
                deste termo. Definida a data, as cotas que vencerem depois dela serão antecipadas para essa data.
              </li>
              <li>
                O {party.toLowerCase()} pode, a qualquer tempo, antecipar o pagamento de uma ou mais cotas, ou quitar o saldo, sem acréscimo. Quitado
                antes da {plan.event}, o valor fica reservado a ela.
              </li>
              <li>
                Não se realizando a {plan.event} por qualquer motivo, a Loja <strong>devolverá</strong> ao {party.toLowerCase()} os valores efetivamente
                pagos neste plano.
              </li>
              {plan.fourthInstructionDate ? (
                <li>Plano antecipado concedido após a 4ª instrução do grau atual, realizada em {formatDateOnly(plan.fourthInstructionDate)}.</li>
              ) : null}
            </ol>
          </div>
        </OfficialDocument>
      </div>
    </main>
  );
}
