// Páginas públicas por módulo (SEO): uma por busca relevante, com texto que expande o módulo da home.
// Só descrevem o que o sistema faz hoje. Sem dado de loja, irmão ou valor. Regra editorial dos guias vale aqui:
// nada de regra "universal" que varia por Potência ou loja — sempre remeter ao regulamento de cada uma.
//
// TODO(SEO): revisar texto — todas as páginas abaixo são RASCUNHO e precisam da revisão do dono antes de divulgar.

import type { GuideBlock } from '@/lib/guides';

export interface ModulePage {
  slug: string;
  /** Busca-alvo; vai no H1. */
  h1: string;
  /** Título curto para o <title> (o sufixo "| Sigma Horus" vem do template). */
  short: string;
  description: string;
  /** AAAA-MM-DD da última revisão do texto. */
  updatedAt: string;
  /** Nome do módulo no texto dos links ("Saiba mais sobre a Tesouraria"). */
  moduleName: string;
  /** Frase do card da home. */
  linkLabel: string;
  intro: string;
  blocks: GuideBlock[];
  faq: { q: string; a: string }[];
}

export const MODULE_PAGES: ModulePage[] = [
  {
    slug: 'tesouraria-loja-maconica',
    h1: 'Tesouraria de loja maçônica',
    short: 'Tesouraria de loja maçônica: mensalidades, Pix e balancete',
    description: 'Tesouraria de loja maçônica em um só sistema: mensalidades, contas a pagar e a receber, Pix, conciliação bancária, fechamento de caixa e balancetes.',
    updatedAt: '2026-10-05',
    moduleName: 'Tesouraria',
    linkLabel: 'Saiba mais sobre a Tesouraria',
    intro:
      'A Tesouraria é o módulo que cuida do dinheiro da loja do começo ao fim: da cobrança da mensalidade ao balancete apresentado em sessão. No Sigma Horus, cada lançamento tem data, valor, categoria e a conta onde o dinheiro entrou ou saiu, e é isso que permite prestar contas sem noites de planilha.',
    blocks: [
      {
        h: 'Mensalidades e cobranças',
        p: [
          'As mensalidades podem ser lançadas de forma recorrente, mês a mês, com a categoria e o vencimento definidos pela loja. Cada irmão recebe a sua cobrança e paga pelo portal, com Pix, e a Tesouraria acompanha o que está pago, em aberto e vencido.',
          'A loja escolhe como quer receber. No Modo Loja, o Pix usa a chave da própria loja, sem tarifa do sistema, e a Tesouraria dá a baixa. No Modo Asaas, a cobrança sai com Pix ou boleto e a baixa é automática. Nos dois casos o irmão paga pelo mesmo portal.',
        ],
      },
      {
        h: 'Contas a pagar e a receber',
        p: ['Despesas e receitas entram como contas, com cadastro de clientes e fornecedores. Cada conta pode ser paga de uma vez ou em parcelas, e o sistema não aceita pagamento acima do saldo em aberto. Despesas podem exigir a aprovação do Venerável Mestre antes do pagamento.'],
      },
      {
        h: 'Contas bancárias, conciliação e caixa',
        ul: [
          'Cadastro das contas da loja (caixa e bancos) e transferências entre elas.',
          'Conciliação bancária: o extrato é importado e cada crédito é conferido com o pagamento correspondente.',
          'Fechamento de caixa por período, com os valores travados depois de encerrado.',
        ],
      },
      {
        h: 'Relatórios e prestação de contas',
        p: ['Balancetes, DRE, fluxo de caixa projetado, orçamento e o razão por categoria saem dos mesmos lançamentos, então os números batem de um relatório para o outro. Os documentos oficiais levam o cabeçalho, o brasão e as assinaturas da loja.'],
      },
      {
        h: 'Inadimplência com critério',
        p: ['O acompanhamento da inadimplência mostra quem está em atraso e há quanto tempo. A loja pode enviar lembretes por e-mail e pelo WhatsApp, calcular multa e juros quando o regulamento prevê e registrar acordos de regularização. O que a loja faz com a situação de cada irmão segue o seu regulamento e a sua Potência.'],
      },
      {
        h: 'Quem acessa o quê',
        p: ['Cada cargo vê apenas a sua área, e cada loja enxerga somente os próprios dados. Toda alteração fica registrada na auditoria, e o backup da base é diário e criptografado.'],
      },
    ],
    faq: [
      { q: 'O sistema serve para a tesouraria de qualquer loja maçônica?', a: 'Sim. O plano de contas, as categorias, o rito, a Potência e os cargos são configurados pela loja, e os relatórios saem com o cabeçalho dela.' },
      { q: 'O irmão paga a mensalidade como?', a: 'Pelo portal do irmão, com Pix. Na conta da loja, o Pix usa a chave da própria loja; pelo Asaas, há Pix ou boleto com baixa automática.' },
      { q: 'Dá para conciliar o extrato do banco?', a: 'Sim. O extrato é importado e cada crédito é conferido com o pagamento registrado, o que evita baixa em duplicidade.' },
      { q: 'Os relatórios servem para a prestação de contas?', a: 'Sim. Balancete, DRE, fluxo de caixa e razão por categoria saem dos mesmos lançamentos e podem ser impressos ou exportados.' },
    ],
  },
  {
    slug: 'controle-de-mensalidades',
    h1: 'Controle de mensalidades da loja maçônica',
    short: 'Controle de mensalidades e inadimplência da loja maçônica',
    description: 'Controle de mensalidades de loja maçônica: cobrança recorrente, Pix, lembretes, acompanhamento da inadimplência e acordos de regularização.',
    updatedAt: '2026-10-05',
    moduleName: 'Controle de mensalidades',
    linkLabel: 'Saiba mais sobre o controle de mensalidades',
    intro:
      'Mensalidade em atraso é, quase sempre, falta de visibilidade: o tesoureiro não vê quem deve, o irmão não sabe quanto deve e o assunto só aparece em sessão. O controle de mensalidades do Sigma Horus coloca a situação de cada irmão na tela da Tesouraria e no portal dele, com o mesmo número nos dois lugares.',
    blocks: [
      {
        h: 'Lançamento recorrente',
        p: ['A mensalidade é lançada de forma recorrente, com vencimento, categoria e valor definidos pela loja. Quando a recorrência está perto do fim, o sistema avisa para que a renovação não seja esquecida.'],
      },
      {
        h: 'Cobrança que chega ao irmão',
        ul: [
          'Lembrete por e-mail antes e depois do vencimento, com um bloco por cobrança.',
          'Pedido pelo WhatsApp com o texto pronto, aberto pela própria Secretaria ou Tesouraria.',
          'Pix com QR Code e copia e cola, e o irmão paga pelo portal sem depender de ninguém.',
        ],
      },
      {
        h: 'Acompanhamento da inadimplência',
        p: ['O relatório de inadimplência mostra, por irmão, quantas mensalidades estão em aberto, o valor e há quantos dias. O relatório de pontualidade mostra quantas foram pagas em dia, quantas depois do vencimento e quantas seguem em aberto. A lista pode ser ordenada por nome ou referência e impressa.'],
      },
      {
        h: 'Multa, juros e acordos',
        p: [
          'A loja decide se cobra multa e juros de mora e com quais percentuais, conforme o seu regulamento. Quando um irmão quer regularizar a dívida, o sistema registra o acordo, divide em parcelas e acompanha cada parcela paga.',
          'O acordo pode ser só de quitação das dívidas com a loja, sem taxa, ou de regularização, com a taxa que a loja definir. As regras de bloqueio e de comunicação à Potência seguem o regulamento de cada uma.',
        ],
      },
      {
        h: 'Benefícios por irmão',
        p: ['A mensalidade pode ter benefícios por idade e tempo de loja ou por concessão da própria loja, e o valor da cobrança acompanha o benefício. Quem concede é o Venerável ou o Administrador.'],
      },
    ],
    faq: [
      { q: 'Como saber quem está inadimplente?', a: 'O relatório de inadimplência lista cada irmão com as mensalidades em aberto, o valor e o tempo de atraso, e pode ser impresso.' },
      { q: 'O sistema cobra multa e juros?', a: 'Se a loja quiser. Os percentuais são definidos pela própria loja, conforme o regulamento dela.' },
      { q: 'Dá para parcelar uma dívida de mensalidades?', a: 'Sim. O acordo registra as parcelas, gera o Pix de cada uma e acompanha o que foi pago.' },
      { q: 'O irmão vê o que deve?', a: 'Sim. O portal mostra as pendências, o histórico de pagamentos e os recibos, e permite pagar com Pix.' },
    ],
  },
  {
    slug: 'portal-do-irmao',
    h1: 'Portal do irmão: pagamento por Pix e histórico',
    short: 'Portal do irmão: pagamento por Pix, histórico e recibos',
    description: 'Portal do irmão da loja maçônica: pague pendências com Pix, consulte o histórico e os recibos, emita a declaração de regularidade e acompanhe a loja.',
    updatedAt: '2026-10-05',
    moduleName: 'Portal do irmão',
    linkLabel: 'Saiba mais sobre o Portal do irmão',
    intro:
      'O portal é a parte do sistema que o próprio irmão usa. Ele entra com o seu e-mail e a sua senha, vê o que a loja registrou sobre ele e resolve sozinho o que antes dependia de perguntar ao tesoureiro. Funciona no navegador do computador e do celular, sem instalar nada.',
    blocks: [
      {
        h: 'Pagar com Pix',
        p: ['O irmão vê as pendências, escolhe uma ou várias e paga com o QR Code ou o copia e cola do Pix. Pelo Asaas, a cobrança é emitida na hora e a baixa é automática. Na conta da loja, o irmão paga e usa o botão "Já paguei", anexando o comprovante, para que a Tesouraria confira e dê a baixa.'],
      },
      {
        h: 'Histórico, recibos e declaração',
        ul: [
          'Histórico de pagamentos por período, para o irmão conferir tudo o que já pagou.',
          'Recibo de cada pagamento, com a assinatura digital da Tesouraria.',
          'Declaração de regularidade, emitida na hora quando o irmão está em dia, para transferência, elevação ou filiação.',
        ],
      },
      {
        h: 'Meu acordo',
        p: ['Quando o irmão tem um acordo de regularização, o portal mostra as parcelas, o Pix de cada uma e o que já foi pago, sem precisar pedir.'],
      },
      {
        h: 'Cadastro e contato',
        p: ['O irmão atualiza o próprio contato, o endereço e os dados da família, e completa o que estiver faltando no cadastro. Nome, rito, grau e cargo continuam sob responsabilidade da Secretaria.'],
      },
      {
        h: 'Vida da loja',
        p: ['O portal traz o calendário de sessões, os documentos institucionais da loja e a Hospitalaria, onde o irmão pode propor uma campanha ou pedir auxílio direto.'],
      },
      {
        h: 'Lembretes e segurança',
        p: [
          'O irmão recebe o aviso antes do vencimento, por e-mail, WhatsApp ou SMS, já com o caminho para pagar. Assim a cobrança chega sem constrangimento e sem depender de alguém lembrar de cobrar.',
          'Cada irmão enxerga apenas os próprios dados. O acesso é por e-mail e senha, com troca da senha provisória no primeiro acesso, e os dados pessoais seguem a LGPD. Tudo o que o irmão faz no portal fica registrado na auditoria da loja.',
        ],
      },
    ],
    faq: [
      { q: 'O irmão precisa instalar algum aplicativo?', a: 'Não. O portal funciona no navegador do computador e do celular.' },
      { q: 'Como o irmão paga pelo portal?', a: 'Com Pix, por QR Code ou copia e cola, uma pendência de cada vez ou várias juntas.' },
      { q: 'A baixa é automática?', a: 'Pelo Asaas, sim. Na conta da loja, o irmão avisa que pagou e anexa o comprovante, e a Tesouraria dá a baixa.' },
      { q: 'O irmão consegue a declaração de regularidade sozinho?', a: 'Sim, quando está em dia com a Tesouraria. A declaração sai com o cabeçalho e as assinaturas da loja.' },
    ],
  },
  {
    slug: 'secretaria-loja-maconica',
    h1: 'Secretaria de loja maçônica: balaústre, convocação e presença',
    short: 'Secretaria de loja maçônica: balaústre, convocação e presença',
    description: 'Secretaria de loja maçônica: cadastro de irmãos e cargos, sessões com ordem do dia, convocação por e-mail, balaústre, livro de presença e visitantes.',
    updatedAt: '2026-10-05',
    moduleName: 'Secretaria',
    linkLabel: 'Saiba mais sobre a Secretaria',
    intro:
      'A Secretaria guarda a memória e a rotina da loja: quem são os irmãos, quais cargos ocupam, quando é a próxima sessão e o que ficou registrado na anterior. O Sigma Horus reúne esses registros em um só lugar, com acesso por cargo, para que a troca de gestão não leve junto o que a loja sabe sobre si mesma.',
    blocks: [
      {
        h: 'Irmãos, cargos e veneralatos',
        p: ['O cadastro reúne dados pessoais, contato, família, grau e datas importantes de cada irmão. Os cargos e os períodos de veneralato ficam registrados, e cada cargo recebe acesso apenas à sua área do sistema.'],
      },
      {
        h: 'Sessões e convocação',
        p: ['Cada sessão tem data, tipo e ordem do dia. A convocação é enviada por e-mail e pode ser dirigida por grau. Antes do envio, o sistema mostra a prévia exata do que cada grupo vai receber, para a Secretaria conferir.'],
      },
      {
        h: 'Balaústre e documentos',
        p: ['O balaústre de cada sessão pode ser guardado junto ao registro dela, e o painel avisa quando uma sessão passada está sem o arquivo. Os documentos institucionais da loja ficam disponíveis para os irmãos.'],
      },
      {
        h: 'Presença, visitantes e certificado',
        ul: [
          'Livro de presença da sessão, com o registro dos irmãos e dos visitantes.',
          'Certificado de visita em PDF, enviado por e-mail e com página de verificação.',
          'Acompanhamento de faltas seguidas, com aviso ao Venerável e ao Hospitaleiro.',
        ],
      },
      {
        h: 'Cadastro completo e candidatos',
        p: ['O painel indica os cadastros incompletos (CPF, e-mail e data de nascimento) e a Secretaria pode pedir os dados por e-mail ou pelo WhatsApp. O processo de admissão de candidatos tem etapas e uma pasta de documentos de acesso restrito.'],
      },
      {
        h: 'Comunicação com os irmãos',
        p: ['Convocações, lembretes e pedidos de atualização de cadastro saem por e-mail, e a Secretaria também pode abrir a conversa pelo WhatsApp com o texto já pronto. Cada envio fica registrado no histórico de mensagens da loja, e uma falha de envio aparece em vez de passar despercebida.'],
      },
      {
        h: 'Gestão que atravessa a troca de cargo',
        p: ['Como os registros ficam no sistema e não em planilhas de quem ocupou o cargo, o Secretário que assume encontra o histórico de sessões, a lista de documentos, o quadro de irmãos e a frequência de cada um. A auditoria mostra quem alterou o quê e quando, o que ajuda a loja a se organizar sem perder a memória.'],
      },
    ],
    faq: [
      { q: 'A convocação é enviada por e-mail?', a: 'Sim. A Secretaria confere a prévia e envia para todos os irmãos ou para os graus escolhidos.' },
      { q: 'Onde fica o balaústre?', a: 'Junto ao registro de cada sessão. O painel avisa quando uma sessão passada ainda está sem o arquivo.' },
      { q: 'O sistema controla a presença?', a: 'Sim. Há o livro de presença da sessão, o registro de visitantes e o aviso de faltas seguidas.' },
      { q: 'Quem pode ver os dados dos irmãos?', a: 'Cada cargo acessa apenas a sua área, e todo acesso e alteração ficam na auditoria, conforme a LGPD.' },
    ],
  },
  {
    slug: 'chancelaria-loja-maconica',
    h1: 'Chancelaria de loja maçônica: quadro de obreiros e alfaias',
    short: 'Chancelaria de loja maçônica: quadro de obreiros e alfaias',
    description: 'Chancelaria de loja maçônica: ritos e graus, quadro de obreiros, inventário de alfaias e materiais, termo de entrega e documentos oficiais.',
    updatedAt: '2026-10-05',
    moduleName: 'Chancelaria',
    linkLabel: 'Saiba mais sobre a Chancelaria',
    intro:
      'A Chancelaria cuida da ordem e da memória da loja: o quadro de obreiros, os graus de cada um, o patrimônio e os documentos oficiais. É o módulo que responde a perguntas como "quem está no quadro?", "onde está esta alfaia?" e "quando o irmão foi elevado?", sem depender da lembrança de quem ocupou o cargo antes.',
    blocks: [
      {
        h: 'Ritos, graus e quadro de obreiros',
        p: ['O rito, a Potência e os graus são configurados pela loja. O quadro social e a composição da loja saem do cadastro, com graus e datas, e a galeria de veneráveis guarda a memória das gestões anteriores.'],
      },
      {
        h: 'Inventário de materiais e alfaias',
        p: ['Os materiais e as alfaias da loja ficam em um inventário. O fornecimento pode ser registrado por grau, como empréstimo, material da Potência, venda ou doação, e gera o termo de entrega para o irmão. Uma venda lança a conta a receber correspondente na Tesouraria.'],
      },
      {
        h: 'Patrimônio',
        p: ['Os bens da loja são cadastrados com a data de aquisição e o valor, para que o patrimônio apareça nos relatórios e na passagem de cargo.'],
      },
      {
        h: 'Documentos oficiais e certificados',
        ul: [
          'Documentos oficiais emitidos com o cabeçalho, o brasão e as assinaturas da loja.',
          'Arquivo de documentos por irmão, com acesso restrito.',
          'Certificados com a arte da loja e página de verificação pública.',
        ],
      },
      {
        h: 'Taxas de grau',
        p: ['As taxas de iniciação, elevação, exaltação e filiação podem ser contratadas em até seis cotas, com o valor travado no dia da contratação. Cada cota é uma cobrança comum do irmão, e o acompanhamento aparece na Tesouraria e no portal.'],
      },
      {
        h: 'Filiação e regularização',
        p: ['A filiação e a regularização de irmãos vindos de outra loja também têm o seu fluxo, com a taxa registrada como cobrança do irmão e acompanhada na Tesouraria, separada da mensalidade. A loja define os valores conforme o seu regulamento.'],
      },
      {
        h: 'Do cadastro ao relatório',
        p: ['Tudo o que a Chancelaria registra alimenta os relatórios da loja: o quadro de obreiros por grau, o inventário de alfaias e o patrimônio. Na passagem de cargo, quem assume a Chancelaria encontra o histórico completo, com as datas de cada grau, os termos de entrega e os documentos emitidos, sem depender de papéis guardados por quem saiu.'],
      },
    ],
    faq: [
      { q: 'Dá para registrar o rito e a Potência da minha loja?', a: 'Sim. Rito, Potência, graus e cargos são configurados pela própria loja.' },
      { q: 'O sistema controla as alfaias?', a: 'Sim. Há o inventário, o registro de empréstimo, doação ou venda, e o termo de entrega.' },
      { q: 'Os documentos saem com o cabeçalho da loja?', a: 'Sim. Os documentos oficiais levam o brasão, o nome da loja e as assinaturas dos responsáveis.' },
      { q: 'Quem acessa os documentos dos irmãos?', a: 'Somente quem tem permissão para a área, e o acesso fica registrado na auditoria.' },
    ],
  },
  {
    slug: 'hospitalaria-loja-maconica',
    h1: 'Hospitalaria de loja maçônica: tronco de beneficência e campanhas',
    short: 'Hospitalaria de loja maçônica: tronco e campanhas',
    description: 'Hospitalaria de loja maçônica: tronco de beneficência com Pix, campanhas de benemerência, pedidos de auxílio pelo portal, aniversários e jubileus.',
    updatedAt: '2026-10-05',
    moduleName: 'Hospitalaria',
    linkLabel: 'Saiba mais sobre a Hospitalaria',
    intro:
      'A Hospitalaria é o cuidado fraterno da loja: acompanhar o irmão que precisa, mobilizar a solidariedade e prestar contas de cada centavo do tronco de beneficência. O Sigma Horus dá ao Hospitaleiro as ferramentas para isso, com os valores do tronco registrados e visíveis para quem tem a responsabilidade de conferir.',
    blocks: [
      {
        h: 'Tronco de beneficência',
        p: ['O tronco tem seu saldo acompanhado, e as entradas e saídas ficam registradas como categorias do plano de contas. Os valores do tronco entram nos relatórios da Tesouraria, e a prestação de contas da Hospitalaria sai dos mesmos lançamentos.'],
      },
      {
        h: 'Campanhas de benemerência',
        p: ['A loja pode abrir campanhas de benemerência, registrar as doações recebidas e convocar os irmãos para participar. O acompanhamento mostra o que foi arrecadado em cada campanha.'],
      },
      {
        h: 'Doação por Pix',
        p: ['O irmão pode contribuir com Pix, pelo portal, e a doação é registrada na campanha ou no tronco. Os doadores de contribuições solidárias podem aparecer de forma discreta nos relatórios, conforme a escolha da loja.'],
      },
      {
        h: 'Pedidos de auxílio',
        p: ['O irmão pode propor uma campanha ou pedir auxílio direto pelo portal. O pedido chega por e-mail ao Venerável, ao Hospitaleiro e ao Administrador, e o histórico fica registrado.'],
      },
      {
        h: 'Aniversários e jubileus',
        p: ['O sistema envia felicitações de aniversário ao irmão e a seus familiares cadastrados, e lembra os jubileus. Quem não deve receber, como um familiar falecido, pode ser marcado no cadastro.'],
      },
      {
        h: 'Discrição e prestação de contas',
        p: ['Os nomes de quem contribui com doações solidárias podem ser tratados com discrição nos relatórios, conforme a escolha da loja, e o saldo do tronco aparece para quem tem a responsabilidade de conferir. Cada lançamento fica na auditoria, com quem registrou e quando.'],
      },
      {
        h: 'Painel do Hospitaleiro',
        p: ['O Hospitaleiro acompanha os pedidos enviados pelos obreiros, as campanhas em andamento e os irmãos com faltas seguidas. Com essas informações em um só lugar, uma visita ou um contato fraterno acontece a tempo, sem depender de a notícia chegar por acaso.'],
      },
    ],
    faq: [
      { q: 'O tronco de beneficência tem controle próprio?', a: 'Sim. O saldo é acompanhado e as entradas e saídas ficam registradas como categorias, com relatório próprio.' },
      { q: 'O irmão pode doar pelo portal?', a: 'Sim. A doação é feita com Pix e registrada na campanha ou no tronco.' },
      { q: 'Como o irmão pede auxílio à loja?', a: 'Pelo portal. O pedido é enviado ao Venerável, ao Hospitaleiro e ao Administrador, com o histórico registrado.' },
      { q: 'O sistema lembra aniversários?', a: 'Sim. Há felicitações de aniversário ao irmão e à família cadastrada, e o aviso de jubileus.' },
    ],
  },
];

export const getModulePage = (slug: string) => MODULE_PAGES.find((m) => m.slug === slug);

/** Número de palavras do texto da página (introdução, blocos e FAQ) — usado no teste de tamanho mínimo. */
export function modulePageWords(m: ModulePage): number {
  const parts: string[] = [m.intro];
  for (const b of m.blocks) parts.push(b.h, ...(b.p ?? []), ...(b.ul ?? []), ...(b.ol ?? []));
  for (const f of m.faq) parts.push(f.q, f.a);
  return parts.join(' ').split(/\s+/).filter(Boolean).length;
}
