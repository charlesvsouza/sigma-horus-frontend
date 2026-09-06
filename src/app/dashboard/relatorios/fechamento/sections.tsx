import type { Closing } from './types';

// Componentes de seção do relatório de fechamento — extraídos para serem
// reusados tanto no relatório completo (impressão/PDF, formato AMORIO) quanto
// nas telas individuais de cada seção (dashboard, ver page.tsx e [secao]/).

export const money = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
export const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

export const TH = 'border-b border-white/10 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-sand-dark';
export const TD = 'border-b border-white/[5%] px-2 py-1.5 text-sand';

export function Section({ title, children, breakBefore }: { title: string; children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <section className={`report-section rcard rounded-xl border border-white/[6%] bg-sigma-card p-6 ${breakBefore ? 'pagebreak' : ''}`}>
      <h2 className="text-lg font-semibold text-sand-light">{title}</h2>
      <div className="mt-4 text-sm text-sand">{children}</div>
    </section>
  );
}

export function BalancoSection({ data, breakBefore }: { data: Closing['balanco']; breakBefore?: boolean }) {
  return (
    <Section title="1. Balanço Financeiro" breakBefore={breakBefore}>
      <table>
        <thead><tr><th className={TH}>Cód.</th><th className={TH}>Conta</th><th className={`${TH} text-right`}>%</th><th className={`${TH} text-right`}>Valor</th></tr></thead>
        <tbody>
          <tr><td className={`${TD} font-semibold text-emerald-300`} colSpan={4}>RECEITAS</td></tr>
          {data.receitas.map((r) => (
            <tr key={r.code + r.name}><td className={TD}>{r.code}</td><td className={TD}>{r.name}</td><td className={`${TD} text-right`}>{r.pct.toFixed(1)}%</td><td className={`${TD} text-right tabular-nums`}>{money(r.value)}</td></tr>
          ))}
          <tr><td className={`${TD} font-semibold`} colSpan={3}>Soma das Receitas</td><td className={`${TD} text-right font-semibold tabular-nums`}>{money(data.somaReceitas)}</td></tr>
          <tr><td className={`${TD} font-semibold text-rose-300`} colSpan={4}>DESPESAS</td></tr>
          {data.despesas.map((r) => (
            <tr key={r.code + r.name}><td className={TD}>{r.code}</td><td className={TD}>{r.name}</td><td className={`${TD} text-right`}>{r.pct.toFixed(1)}%</td><td className={`${TD} text-right tabular-nums`}>{money(r.value)}</td></tr>
          ))}
          <tr><td className={`${TD} font-semibold`} colSpan={3}>Soma das Despesas</td><td className={`${TD} text-right font-semibold tabular-nums`}>{money(data.somaDespesas)}</td></tr>
        </tbody>
      </table>
      <div className="mt-3 flex justify-end gap-8 text-sm">
        <span className="text-sand-dark">Saldo Anterior: <strong className="text-sand-light tabular-nums">{money(data.saldoAnterior)}</strong></span>
        <span className="text-sand-dark">Saldo Atual: <strong className="text-gold tabular-nums">{money(data.saldoAtual)}</strong></span>
      </div>
    </Section>
  );
}

export function BalanceteSection({ data, breakBefore }: { data: Closing['balancete']; breakBefore?: boolean }) {
  return (
    <Section title="2. Balancete de Verificação por Plano de Contas" breakBefore={breakBefore}>
      <table>
        <thead><tr><th className={TH}>Cód.</th><th className={TH}>Conta</th><th className={`${TH} text-right`}>Saldo Ant.</th><th className={`${TH} text-right`}>Débitos</th><th className={`${TH} text-right`}>Créditos</th><th className={`${TH} text-right`}>Saldo Atual</th></tr></thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.code + b.name}>
              <td className={TD}>{b.code}</td><td className={TD}>{b.name}</td>
              <td className={`${TD} text-right tabular-nums`}>{money(b.saldoAnterior)}</td>
              <td className={`${TD} text-right tabular-nums`}>{b.debitos ? money(b.debitos) : '—'}</td>
              <td className={`${TD} text-right tabular-nums`}>{b.creditos ? money(b.creditos) : '—'}</td>
              <td className={`${TD} text-right tabular-nums`}>{money(b.saldoAtual)}</td>
            </tr>
          ))}
          {data.length === 0 ? <tr><td className={TD} colSpan={6}>Sem movimentação no período.</td></tr> : null}
        </tbody>
      </table>
    </Section>
  );
}

export function ReceitasDespesasSection({ data, breakBefore }: { data: Closing['receitasDespesas']; breakBefore?: boolean }) {
  const maxRD = Math.max(1, ...data.flatMap((m) => [m.receita, m.despesa]));
  return (
    <Section title="3. Receitas × Despesas (mensal)" breakBefore={breakBefore}>
      {data.length === 0 ? <p className="text-sand-dark">Sem dados no período.</p> : (
        <div className="space-y-3">
          {data.map((m) => (
            <div key={m.mes}>
              <div className="flex justify-between text-xs text-sand-dark"><span>{m.mes}</span><span>R: {money(m.receita)} · D: {money(m.despesa)}</span></div>
              <div className="mt-1 space-y-1">
                <div className="h-3 rounded bg-emerald-500/70" style={{ width: `${(m.receita / maxRD) * 100}%` }} />
                <div className="h-3 rounded bg-rose-500/70" style={{ width: `${(m.despesa / maxRD) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function LivroCaixaSection({ data, saldoAnterior, breakBefore }: { data: Closing['livroCaixa']; saldoAnterior: number; breakBefore?: boolean }) {
  return (
    <Section title="4. Livro Caixa / Extrato" breakBefore={breakBefore}>
      <table>
        <thead><tr><th className={TH}>Data</th><th className={TH}>Nome</th><th className={TH}>Plano</th><th className={TH}>Histórico</th><th className={`${TH} text-right`}>Valor</th><th className={`${TH} text-right`}>Saldo</th></tr></thead>
        <tbody>
          <tr><td className={`${TD} text-sand-dark`} colSpan={5}>Saldo Anterior</td><td className={`${TD} text-right tabular-nums`}>{money(saldoAnterior)}</td></tr>
          {data.map((l, i) => (
            <tr key={i}>
              <td className={TD}>{fmtDate(l.data)}</td><td className={TD}>{l.nome}</td><td className={TD}>{l.plano}</td><td className={TD}>{l.historico}</td>
              <td className={`${TD} text-right tabular-nums ${l.value < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{money(l.value)}</td>
              <td className={`${TD} text-right tabular-nums`}>{money(l.saldo)}</td>
            </tr>
          ))}
          {data.length === 0 ? <tr><td className={TD} colSpan={6}>Sem lançamentos no período.</td></tr> : null}
        </tbody>
      </table>
    </Section>
  );
}

export function CobrancasSection({ data, breakBefore }: { data: Closing['cobrancas']; breakBefore?: boolean }) {
  return (
    <Section title="5. Cobranças em Geral" breakBefore={breakBefore}>
      <table>
        <thead><tr><th className={TH}>Nº</th><th className={TH}>Destinatário</th><th className={`${TH} text-right`}>Valor</th><th className={TH}>Vencimento</th><th className={TH}>Situação</th></tr></thead>
        <tbody>
          {data.items.map((c, i) => (
            <tr key={i}><td className={TD}>{c.number}</td><td className={TD}>{c.member}</td><td className={`${TD} text-right tabular-nums`}>{money(c.amount)}</td><td className={TD}>{fmtDate(c.dueDate)}</td><td className={TD}>{c.status}</td></tr>
          ))}
          {data.items.length === 0 ? <tr><td className={TD} colSpan={5}>Sem cobranças no período.</td></tr> : null}
        </tbody>
      </table>
      <p className="mt-2 text-right text-sm text-sand-dark">Total: <strong className="text-sand-light tabular-nums">{money(data.total)}</strong></p>
    </Section>
  );
}

export function SaldoIrmaosSection({ data, breakBefore }: { data: Closing['saldoIrmaos']; breakBefore?: boolean }) {
  return (
    <Section title="6. Saldo dos Irmãos" breakBefore={breakBefore}>
      <table>
        <thead><tr><th className={TH}>Irmão</th><th className={`${TH} text-right`}>Débito</th><th className={`${TH} text-right`}>Crédito</th><th className={`${TH} text-right`}>Saldo</th></tr></thead>
        <tbody>
          {data.map((s, i) => (
            <tr key={i}><td className={TD}>{s.name}</td><td className={`${TD} text-right tabular-nums`}>{money(s.debito)}</td><td className={`${TD} text-right tabular-nums`}>{money(s.credito)}</td><td className={`${TD} text-right tabular-nums ${s.saldo > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{money(s.saldo)}</td></tr>
          ))}
          {data.length === 0 ? <tr><td className={TD} colSpan={4}>Sem irmãos com movimentação.</td></tr> : null}
        </tbody>
      </table>
    </Section>
  );
}
