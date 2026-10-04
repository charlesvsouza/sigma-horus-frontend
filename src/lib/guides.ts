// Guias públicos (SEO): páginas curtas por assunto da tesouraria de loja maçônica. Quem procura no Google pesquisa
// o problema, não o nome do sistema. Conteúdo estático, sem dados de lojas, irmãos ou valores.
// Regra editorial: nada de regra "universal" que varia por Potência/loja — sempre remeter ao regulamento de cada uma.

export interface GuideBlock {
  h: string;
  p?: string[];
  ul?: string[];
  ol?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface Guide {
  slug: string;
  title: string;
  /** Título curto (até ~48 caracteres): vai no <title> da página e nas listas de links, para o Google não cortar. */
  short: string;
  description: string;
  /** AAAA-MM-DD da última revisão do texto. */
  updatedAt: string;
  intro: string;
  blocks: GuideBlock[];
  /** Fecho com o que o Sigma Horus faz sobre o assunto (CTA suave). */
  cta: string;
}

export const GUIDES: Guide[] = [
  {
    slug: 'balancete-loja-maconica',
    title: 'Como fazer o balancete de uma loja maçônica',
    short: 'Como fazer o balancete da loja maçônica',
    description: 'Passo a passo para montar o balancete da tesouraria de uma loja maçônica: plano de contas, lançamentos, conciliação com o extrato e erros comuns.',
    updatedAt: '2026-10-04',
    intro:
      'O balancete é o demonstrativo que a Tesouraria apresenta à Loja para mostrar, em um período, quanto entrou, quanto saiu e qual é o saldo — tudo agrupado por categoria. Feito com método, ele deixa de ser uma noite de planilha antes da sessão e passa a ser um relatório que sai pronto.',
    blocks: [
      {
        h: 'O que o balancete mostra',
        p: ['Em essência, uma conta simples: saldo anterior + receitas do período − despesas do período = saldo final. A diferença para um extrato é que cada valor aparece dentro de uma categoria (mensalidades, tronco de beneficência, energia, contribuição à Potência…), e é isso que permite à Loja entender de onde veio e para onde foi o dinheiro.'],
      },
      {
        h: 'Passo a passo',
        ol: [
          'Defina o plano de contas: a lista de categorias de receita e de despesa que a loja usa. Quanto mais estável, mais comparáveis ficam os balancetes de um mês para o outro.',
          'Lance todas as entradas e saídas do período, cada uma com data, valor, categoria e a conta onde o dinheiro entrou ou saiu (caixa ou banco).',
          'Confira com o extrato bancário: o saldo de cada conta no sistema ou na planilha precisa bater com o do banco no último dia do período. Diferença é lançamento esquecido, duplicado ou na data errada.',
          'Some por categoria e monte o demonstrativo: saldo anterior, receitas e despesas por categoria, saldo final.',
          'Feche o período. Depois de apresentado e aprovado, o balancete não deve mais mudar — qualquer correção vira lançamento no período seguinte, com a devida anotação.',
        ],
      },
      {
        h: 'Erros comuns',
        ul: [
          'Lançamento sem categoria: vai para “sem classificação” e o balancete perde o sentido.',
          'Misturar fundos com o caixa geral. O Tronco de Beneficência, por exemplo, costuma ser mais claro como categoria própria, com o saldo acompanhado à parte.',
          'Esquecer o saldo de abertura: ao começar a escriturar, o saldo que já existia precisa entrar como ponto de partida.',
          'Tratar pagamento antecipado ou atrasado como se fosse do mês do lançamento: o que importa para a prestação de contas é a data em que o dinheiro de fato entrou.',
          'Corrigir período já aprovado: gera dois balancetes diferentes para o mesmo mês.',
        ],
      },
      {
        h: 'Quando vale sair da planilha',
        p: ['A planilha funciona enquanto o volume é pequeno e há uma só pessoa cuidando dela. Quando a loja passa a ter muitos irmãos pagando por Pix, acordos de regularização e fundos distintos, o risco deixa de ser o cálculo e passa a ser a rotina: quem lançou o quê, e onde está o comprovante.'],
      },
    ],
    cta: 'No Sigma Horus o balancete sai por plano de contas, a conciliação bancária sugere a baixa de cada crédito do extrato, e o encerramento do veneralato segue três passos: o Tesoureiro calcula, o Venerável aprova e o Administrador encerra o período.',
  },
  {
    slug: 'mensalidade-em-atraso-loja-maconica',
    title: 'Mensalidade em atraso na loja maçônica: como organizar a cobrança',
    short: 'Mensalidade em atraso na loja maçônica',
    description: 'Como organizar a cobrança de mensalidades em atraso na loja maçônica, com respeito e registro: faixas de atraso, lembretes, acordos e comunicação à Potência.',
    updatedAt: '2026-10-04',
    intro:
      'Cobrar um irmão exige firmeza e discrição. O que costuma funcionar não é cobrar mais, e sim cobrar com método: saber quem está em atraso e há quanto tempo, lembrar antes de vencer, oferecer um caminho de regularização e deixar tudo registrado.',
    blocks: [
      {
        h: 'Comece por enxergar o atraso em faixas',
        p: ['Uma lista única de devedores não ajuda a decidir o que fazer. Separe os irmãos por tempo de atraso, por exemplo: 1 a 30 dias, 31 a 60, 61 a 90 e mais de 90. Cada faixa pede uma abordagem diferente: lembrete, conversa, proposta de acordo.'],
      },
      {
        h: 'A regra de inadimplência é do regulamento, não do sistema',
        p: ['Cada Potência e cada loja tem a sua regra sobre inadimplência — inclusive o prazo de atraso a partir do qual o irmão é enquadrado e quais são as consequências. Consulte o regulamento da sua obediência e do seu Regimento Interno antes de agir. A decisão de comunicar a Potência é sempre da diretoria, normalmente do Venerável Mestre.'],
      },
      {
        h: 'Uma rotina simples',
        ol: [
          'Antes do vencimento: lembrete por e-mail ou WhatsApp, já com a forma de pagar (Pix com QR Code ou copia e cola).',
          'Logo após o vencimento: aviso cordial, com o valor e o vencimento original.',
          'Atraso que se prolonga: conversa pessoal e, se fizer sentido, proposta de acordo — tudo à vista ou em poucas parcelas, com o valor combinado por escrito.',
          'Registro: cada contato, cada acordo e cada pagamento ficam anotados, para que o próximo Tesoureiro não comece do zero.',
        ],
      },
      {
        h: 'Acordo: quitar a dívida ou regularizar',
        p: [
          'Nem todo irmão quer, ou precisa, fazer as duas coisas ao mesmo tempo. Vale separar dois tipos de acordo: o de quitação, que trata só das dívidas com a loja, e o de regularização, que soma a taxa de regularização que a loja cobrar. Quem apenas quita as dívidas pode depois pedir o Placet ou regularizar mais adiante.',
          'Seja qual for o tipo, o acordo precisa de valor total, número de parcelas, datas e a ciência das partes. Um termo assinado evita mal-entendidos meses depois.',
        ],
      },
      {
        h: 'Cuidados com a discrição',
        ul: [
          'Cobrança individual, por canal privado — nunca em grupo.',
          'Relatórios de inadimplência com nome de irmão são para a diretoria, não para circular.',
          'Registre só o necessário e guarde com acesso restrito.',
        ],
      },
    ],
    cta: 'O Sigma Horus traz o relatório de inadimplência por faixas de atraso, lembretes por e-mail e WhatsApp, acordos de quitação e de regularização com a cobrança de cada parcela por Pix, e a declaração de regularidade que o irmão emite quando está em dia.',
  },
  {
    slug: 'pix-baixa-automatica-tesouraria-loja',
    title: 'Pix com baixa automática na tesouraria da loja: como funciona',
    short: 'Pix com baixa automática na tesouraria da loja',
    description: 'Duas formas de receber por Pix na tesouraria da loja maçônica: direto na chave da loja ou por intermediário com baixa automática. Veja como escolher.',
    updatedAt: '2026-10-04',
    intro:
      'Receber mensalidades por Pix é o caminho mais prático para o irmão. A dúvida da Tesouraria é outra: como saber, sem conferir extrato linha por linha, quem já pagou? Há dois caminhos, com vantagens diferentes.',
    blocks: [
      {
        h: 'Caminho 1 — Pix direto na chave da loja',
        p: ['O irmão paga para a chave Pix da loja, com o valor já preenchido num QR Code ou no “copia e cola”. O dinheiro cai direto na conta da loja, sem intermediário e sem tarifa de plataforma. O limite é que a conta bancária não avisa o sistema: a baixa é feita pela Tesouraria, conferindo o extrato ou a partir do aviso “já paguei” do irmão.'],
      },
      {
        h: 'Caminho 2 — Cobrança por um intermediário com baixa automática',
        p: ['Uma instituição de pagamento emite a cobrança (Pix ou boleto) e avisa o sistema quando ela é paga: a baixa acontece sozinha, sem conferência manual. Em compensação, a instituição cobra uma tarifa por recebimento e repassa o valor para a conta da loja depois. A loja precisa decidir se absorve essa tarifa ou se a repassa ao irmão.'],
      },
      {
        h: 'Como escolher',
        table: {
          head: ['', 'Direto na chave da loja', 'Com baixa automática'],
          rows: [
            ['Tarifa', 'Nenhuma da plataforma', 'Tarifa por recebimento'],
            ['Baixa', 'Manual (extrato ou aviso do irmão)', 'Automática'],
            ['Dinheiro', 'Cai direto na conta da loja', 'Passa pela instituição e é repassado'],
            ['Indicado quando', 'Poucos pagamentos ou tesoureiro presente', 'Muitos pagamentos, pouca disponibilidade para conferir'],
          ],
        },
      },
      {
        h: 'Boas práticas nos dois casos',
        ul: [
          'Todo recebimento deve entrar na conta corrente da loja e aparecer no livro caixa — nada fica “em trânsito” fora da escrituração.',
          'Confira o extrato com os lançamentos pelo menos uma vez por mês.',
          'Guarde o comprovante e emita recibo; o irmão deve conseguir consultar o próprio histórico.',
          'Se há tarifa, lance-a como despesa para o saldo do sistema bater com o do banco.',
        ],
      },
    ],
    cta: 'No Sigma Horus a loja escolhe o modo: Pix direto na chave da loja (sem tarifa da plataforma) ou cobrança com baixa automática. O irmão paga pelo portal, e a conciliação bancária ajuda a dar baixa nos créditos do extrato.',
  },
  {
    slug: 'prestacao-de-contas-fim-do-veneralato',
    title: 'Prestação de contas ao fim do veneralato: o que reunir',
    short: 'Prestação de contas ao fim do veneralato',
    description: 'Checklist para a prestação de contas da tesouraria ao fim do veneralato: relatórios a reunir, conferências, aprovação e como passar o saldo ao próximo período.',
    updatedAt: '2026-10-04',
    intro:
      'Ao fim do veneralato, a Tesouraria presta contas à Loja e entrega ao próximo período uma escrituração limpa. Quem se organiza durante o ano chega a essa noite com tudo pronto; quem deixa para o fim passa semanas reconstruindo lançamentos.',
    blocks: [
      {
        h: 'O que reunir',
        p: ['O conjunto exato exigido varia por Potência e por loja; este é um núcleo que costuma estar presente:'],
        ul: [
          'Balanço financeiro do período: saldo inicial, receitas, despesas e saldo final.',
          'Balancete por categoria (plano de contas).',
          'Receitas e despesas mês a mês, para mostrar a evolução ao longo do ano.',
          'Livro caixa, com cada movimentação em ordem cronológica.',
          'Posição das cobranças: o que foi cobrado, recebido e o que ficou em aberto.',
          'Saldo dos irmãos: o que cada um tem em aberto ou antecipado com a loja.',
          'Extratos bancários e comprovantes que sustentam os lançamentos.',
        ],
      },
      {
        h: 'Antes de apresentar',
        ol: [
          'Concilie todas as contas (caixa e bancos) com os extratos do último dia do período.',
          'Revise lançamentos sem categoria e contas a pagar ainda sem baixa.',
          'Confira o saldo de cada fundo (por exemplo, o Tronco de Beneficência) e se ele bate com o relatório.',
          'Apresente os relatórios à diretoria para aprovação, com as assinaturas que o seu regulamento pedir.',
        ],
      },
      {
        h: 'Encerrar e passar adiante',
        p: [
          'Depois da aprovação, o período se encerra: nada mais é lançado nele. O saldo final de um veneralato vira o saldo inicial do seguinte, para a escrituração continuar sem buraco.',
          'Se aparecer um lançamento esquecido depois do encerramento, registre-o no período novo, com observação, em vez de reabrir o anterior.',
        ],
      },
      {
        h: 'Erros que dão trabalho depois',
        ul: [
          'Encerrar sem conciliar o banco.',
          'Passar para o próximo período um saldo diferente do aprovado.',
          'Deixar a prestação de contas sem assinatura ou sem registro de quem aprovou.',
        ],
      },
    ],
    cta: 'No Sigma Horus a suíte de fechamento já reúne balanço financeiro, balancete por categoria, receitas e despesas por mês, livro caixa, cobranças e saldo dos irmãos. O encerramento é em três passos e trava lançamentos no período fechado; o saldo final é herdado pelo novo período.',
  },
  {
    slug: 'modelo-planilha-tesouraria-loja-maconica',
    title: 'Modelo de planilha de tesouraria para loja maçônica (com plano de contas)',
    short: 'Planilha de tesouraria para loja maçônica',
    description: 'Modelo de planilha para a tesouraria de uma loja maçônica: colunas, plano de contas sugerido de receitas e despesas e dicas para manter a escrituração em dia.',
    updatedAt: '2026-10-04',
    intro:
      'Uma boa planilha de tesouraria tem poucas colunas e um plano de contas bem pensado. Abaixo, um modelo que você pode copiar para o Excel ou o Google Planilhas, com as categorias que a maioria das lojas usa — adapte à realidade da sua.',
    blocks: [
      {
        h: 'As colunas',
        table: {
          head: ['Coluna', 'O que registrar'],
          rows: [
            ['Data', 'O dia em que o dinheiro entrou ou saiu (não o da emissão)'],
            ['Descrição', 'O que foi e, quando for de um irmão, o nome — somente na planilha da Tesouraria'],
            ['Categoria', 'Uma categoria do plano de contas (abaixo)'],
            ['Conta', 'Caixa ou o banco onde o valor entrou ou saiu'],
            ['Entrada', 'Valor recebido'],
            ['Saída', 'Valor pago'],
            ['Saldo', 'Saldo corrente da conta após o lançamento'],
            ['Comprovante', 'Número do recibo ou nome do arquivo guardado'],
          ],
        },
      },
      {
        h: 'Receitas',
        ul: [
          'Receitas próprias: mensalidades; taxas de iniciação, elevação, exaltação, filiação e regularização; doações e contribuições; Tronco de Beneficência; jantar ritualístico; taxa paramaçônica.',
          'Outras receitas: rendimentos de aplicação financeira; cessão ou aluguel do templo; venda de materiais e paramentos; estorno de despesa; receitas de eventos.',
        ],
      },
      {
        h: 'Despesas',
        ul: [
          'Administrativas: energia elétrica, água e esgoto, telefone e internet, impostos e taxas, material de expediente, concessão ou aluguel da sede, despesas bancárias, serviços de terceiros, limpeza e copa, jantar ritualístico, despesas com eventos e contribuição à Potência.',
          'Investimentos: móveis e utensílios, equipamentos, manutenção de equipamentos, seguros, obras e benfeitorias.',
          'Assistência e manutenção: ação social e caridade, manutenção preventiva e corretiva, material ritualístico e paramentos.',
        ],
      },
      {
        h: 'Dicas para a planilha não virar problema',
        ul: [
          'Use sempre as mesmas categorias; criar uma nova a cada mês impede comparar períodos.',
          'Uma aba por conta (caixa e cada banco) e uma aba-resumo que soma tudo por categoria.',
          'Concilie com o extrato todo mês e marque o que já foi conferido.',
          'Proteja a planilha: acesso restrito e cópia de segurança fora do computador do Tesoureiro.',
          'Se o Tronco de Beneficência existe, acompanhe o saldo dele à parte do caixa geral.',
        ],
      },
      {
        h: 'Quando a planilha deixa de bastar',
        p: ['Quando vários irmãos pagam por Pix, quando há acordos parcelados, ou quando a diretoria muda e a próxima pessoa precisa entender o histórico, a planilha começa a custar mais do que economiza. É a hora de migrar para um sistema que já traga o plano de contas pronto e guarde quem fez cada lançamento.'],
      },
    ],
    cta: 'O Sigma Horus já vem com um plano de contas para loja maçônica semelhante a este, com livro caixa, balancete e relatórios prontos, e importa o cadastro de membros por planilha e o histórico financeiro de sistemas compatíveis.',
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
