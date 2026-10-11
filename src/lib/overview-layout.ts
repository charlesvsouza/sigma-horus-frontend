import type { OverviewGroup, OverviewItem } from './overview-server';

// Como a Visão geral se organiza (decisão do dono, 2026-10-10: "sem muita poluição"):
//  - "Precisa de atenção": UMA lista, de todas as áreas do cargo, só com o que é MAIOR QUE ZERO — atrasos primeiro
//    (vermelho), depois o que espera decisão ou conferência (dourado).
//  - "Para acompanhar": faixa discreta com o que é só informação (próxima sessão, Tronco, pontualidade, assinatura…);
//    número zero some.
// Os indicadores continuam sendo calculados em overview-server.ts; aqui só se decide onde cada um aparece.

/** Indicadores que pedem uma ação de alguém. */
export const ATTENTION_KEYS = ['extrato', 'recorrencias', 'visto', 'reembolsos', 'art002', 'acordos-atrasados', 'balaustres', 'cadastros', 'faltas', 'pedidos'];

/** Indicadores só informativos, na ordem em que aparecem. */
export const FOLLOW_ORDER = ['proxima', 'pontualidade', 'tronco', 'tronco-sessao', 'aniversarios', 'candidatos', 'acordos', 'campanhas', 'assinatura'];

const TONE_RANK: Record<string, number> = { rose: 0, gold: 1, muted: 2, emerald: 3 };

// Número zero e valor vazio ("—", ex.: sem próxima sessão marcada) não ocupam espaço.
const shown = (i: OverviewItem) => (typeof i.value === 'number' ? i.value > 0 : i.value !== '—');

export interface OverviewLayout { attention: OverviewItem[]; follow: OverviewItem[] }

/**
 * Separa os indicadores em "atenção" e "acompanhar". `extraAttention` traz os que a página calcula por fora
 * (contas e cobranças vencidas, ocorrências de inventário).
 */
export function splitOverview(groups: OverviewGroup[], extraAttention: OverviewItem[] = []): OverviewLayout {
  const all = groups.flatMap((g) => g.items);
  const attention = [...extraAttention, ...all.filter((i) => ATTENTION_KEYS.includes(i.key))]
    .filter(shown)
    // Vermelho (atrasado) antes do dourado (esperando decisão); dentro de cada tom, mantém a ordem de chegada.
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (TONE_RANK[a.item.tone] ?? 9) - (TONE_RANK[b.item.tone] ?? 9) || a.index - b.index)
    .map((x) => x.item);
  const follow = FOLLOW_ORDER.map((key) => all.find((i) => i.key === key)).filter((i): i is OverviewItem => Boolean(i)).filter(shown);
  return { attention, follow };
}
