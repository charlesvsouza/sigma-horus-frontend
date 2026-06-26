import type { Metadata } from 'next';
import { LegalDoc, Section } from '@/components/legal-doc';

export const metadata: Metadata = {
  title: 'Manual do Usuário — Sigma Horus',
  description:
    'Guia completo de uso do Sigma Horus: primeiros passos, papéis de acesso, módulos, assinatura e a seção das Luzes e oficiais da loja.',
};

function Office({ name, light, tradition, system }: { name: string; light?: boolean; tradition: string; system: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-sigma-blue-dark/40 p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold text-sand-light">
        {name}
        {light ? (
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-gold">
            Luz da loja
          </span>
        ) : null}
      </h3>
      <p className="mt-2 text-sm leading-6 text-sand">{tradition}</p>
      <p className="mt-2 text-sm leading-6 text-sand-dark">
        <strong className="text-sand">No Sigma Horus:</strong> {system}
      </p>
    </div>
  );
}

export default function ManualPage() {
  return (
    <LegalDoc
      eyebrow="Guia do usuário"
      title="Manual do Sigma Horus"
      updatedAt="26 de junho de 2026"
      intro={
        <>
          Este manual explica como usar o Sigma Horus no dia a dia da loja e esclarece as questões comerciais e
          jurídicas da contratação. Há uma seção dedicada às <strong>Luzes e aos oficiais</strong> da loja, ligando
          cada cargo ao que ele faz na plataforma.
        </>
      }
    >
      <Section id="indice" title="O que você encontra aqui">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><a className="text-gold hover:text-gold-light" href="#primeiros-passos">Primeiros passos</a> — do convite ao período de teste.</li>
          <li><a className="text-gold hover:text-gold-light" href="#papeis">Papéis de acesso</a> — quem pode ver e fazer o quê.</li>
          <li><a className="text-gold hover:text-gold-light" href="#luzes">As Luzes e os oficiais</a> — cada cargo no sistema.</li>
          <li><a className="text-gold hover:text-gold-light" href="#modulos">Os módulos</a> — tesouraria, sessões, documentos e mais.</li>
          <li><a className="text-gold hover:text-gold-light" href="#assinatura">Assinatura e cobrança</a> — planos, trial, cartão e boleto.</li>
          <li><a className="text-gold hover:text-gold-light" href="#regras">Reembolso, upgrade e downgrade</a> — as regras com clareza.</li>
          <li><a className="text-gold hover:text-gold-light" href="#juridico">Privacidade e questões jurídicas</a>.</li>
        </ul>
      </Section>

      <Section id="primeiros-passos" n={1} title="Primeiros passos">
        <p>
          O cadastro é <strong>por convite</strong>. Com o código (ou link) recebido, acesse a página de criação de
          loja, informe os dados da loja, escolha o rito praticado e crie o primeiro administrador.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Abra o link do convite (<code>/onboarding?invite=SEU-CÓDIGO</code>) ou informe o código manualmente.</li>
          <li>Cadastre o nome da loja, o rito e o administrador (nome, e-mail e senha).</li>
          <li>Sua loja já nasce semeada com ritos, potências, os cargos do rito escolhido e um plano de contas padrão.</li>
          <li>Começa então o <strong>período de teste de 10 dias</strong> no plano Oficina, com acesso completo.</li>
          <li>Antes de o teste terminar, escolha um dos três planos em <em>Assinatura</em> para continuar.</li>
        </ol>
        <p>
          Ao fim dos 10 dias sem assinatura, o acesso é pausado até a contratação de um plano — seus dados permanecem
          guardados.
        </p>
      </Section>

      <Section id="papeis" n={2} title="Papéis de acesso (RBAC)">
        <p>
          O acesso é controlado por <strong>papel × recurso × ação</strong>: cada usuário só vê e faz o que o seu papel
          permite, e sempre dentro da sua loja (isolamento por <em>tenant</em>). O Administrador atribui os papéis.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Administrador:</strong> gestão da conta, usuários, assinatura, integrações e configurações.</li>
          <li><strong>Venerável:</strong> visão gerencial completa, relatórios e aprovações; não lança baixas financeiras.</li>
          <li><strong>Tesoureiro:</strong> lança e baixa contas, emite cobranças, fecha o caixa e vê relatórios financeiros.</li>
          <li><strong>Secretário:</strong> cadastros de membros, cargos, períodos, sessões e presença; relatórios não financeiros.</li>
          <li><strong>Membro (obreiro):</strong> acesso ao próprio portal — extrato, débitos, histórico e documentos pertinentes.</li>
        </ul>
        <p className="text-sm text-sand-dark">
          O <strong>cargo maçônico</strong> (registrado em Cargos e Veneralato) é o registro histórico e cerimonial; o
          <strong> papel de acesso</strong> é o que define as permissões no sistema. A loja decide qual papel cada
          oficial recebe.
        </p>
      </Section>

      <Section id="luzes" n={3} title="As Luzes e os oficiais da loja">
        <p>
          Tradicionalmente, as <strong>três Luzes</strong> que governam a loja são o Venerável Mestre e os dois
          Vigilantes; junto deles, os oficiais administrativos conduzem a secretaria, a tesouraria, a chancelaria e a
          hospitalaria. Abaixo, o papel de cada um e como ele se reflete no Sigma Horus.
        </p>

        <div className="not-prose grid gap-4">
          <Office
            name="Venerável Mestre"
            light
            tradition="Preside e governa os trabalhos da loja, máxima autoridade da gestão. Conduz as sessões, zela pela harmonia e responde pela administração geral durante o veneralato."
            system="Costuma receber o papel Venerável (visão gerencial, relatórios e aprovações). Acompanha o painel de indicadores, a inadimplência, a frequência e o fechamento do veneralato. Quando também administra a conta, acumula o papel Administrador."
          />
          <Office
            name="1º Vigilante"
            light
            tradition="Segunda Luz, dirige a Coluna dos Companheiros e substitui o Venerável em seus impedimentos. Cuida da disciplina e do andamento dos trabalhos."
            system="Em geral recebe o papel Membro (com portal próprio) ou um papel ampliado conforme a loja decidir. Acompanha sessões e presença; pode auxiliar a secretaria se a loja lhe conceder esse acesso."
          />
          <Office
            name="2º Vigilante"
            light
            tradition="Terceira Luz, dirige a Coluna dos Aprendizes e zela pela instrução e pela assiduidade dos obreiros mais novos."
            system="Normalmente com papel Membro. Apoia o controle de presença e a frequência dos obreiros; útil no acompanhamento de quem precisa de atenção (faltas, justificativas)."
          />
          <Office
            name="Orador"
            tradition="Guardião da lei e da justiça nos trabalhos; zela pelo cumprimento dos estatutos e dá pareceres. (Presente na maioria dos ritos.)"
            system="Papel Membro, com acesso de leitura ao que lhe couber. Apoia-se na trilha de auditoria e nos relatórios para fundamentar pareceres sobre a regularidade da gestão."
          />
          <Office
            name="Secretário"
            tradition="A administração viva da loja: convocações, atas, correspondência e o quadro de obreiros. Mantém a memória dos trabalhos."
            system="Recebe o papel Secretário: cadastra membros, cargos, períodos e sessões; registra presença; organiza o Centro de Documentos (atas, convocações) e emite relatórios não financeiros."
          />
          <Office
            name="Tesoureiro"
            tradition="O coração financeiro da loja: arrecada as mensalidades, paga as despesas, guarda os valores e presta contas do caixa."
            system="Recebe o papel Tesoureiro: emite cobranças (boleto/PIX pela conta da própria loja), dá baixas, lança contas a pagar e a receber, fecha o caixa do veneralato e acompanha os relatórios financeiros."
          />
          <Office
            name="Chanceler"
            tradition="Cuida das relações externas, dos diplomas e certificados, do selo e da correspondência oficial com a Potência e outras lojas."
            system="Papel Secretário ou Membro, conforme a loja. Usa o Centro de Documentos para diplomas e certificados e os cadastros de membros para manter regular a situação de cada obreiro perante a Potência."
          />
          <Office
            name="Hospitaleiro"
            tradition="O cuidado fraterno: assistência a obreiros e famílias, o tronco de beneficência, visitas, aniversários e bem-estar."
            system="Papel Membro (ou ampliado). Acompanha o tronco de beneficência pelas contas/tesouraria, usa a Comunicação para lembretes e felicitações (aniversários) e o cadastro para acompanhar quem precisa de assistência."
          />
        </div>

        <p className="text-sm text-sand-dark">
          A nomenclatura dos cargos varia conforme o rito; sua loja já nasce com os cargos corretos do rito escolhido e
          pode editá-los em <em>Cargos</em>. O vínculo cargo × período de veneralato fica em <em>Veneralato</em>.
        </p>
      </Section>

      <Section id="modulos" n={4} title="Os módulos do sistema">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Tesouraria:</strong> cobranças e mensalidades, boletos e PIX com baixa automática, contas a pagar e a receber, fechamento de caixa e balancetes.</li>
          <li><strong>Cadastros:</strong> membros, cargos por rito, períodos de veneralato, ritos, potências e plano de contas.</li>
          <li><strong>Sessões e Presença:</strong> agenda de sessões e registro de presença, com frequência por obreiro.</li>
          <li><strong>Centro de Documentos:</strong> atas, comprovantes e certificados em armazenamento privado, com download por link assinado.</li>
          <li><strong>Relatórios:</strong> extratos, inadimplência, fluxo de caixa por período, com exportação.</li>
          <li><strong>Comunicação:</strong> avisos e lembretes aos membros (em evolução).</li>
          <li><strong>Auditoria:</strong> trilha imutável de quem fez o quê e quando.</li>
          <li><strong>Portal do obreiro:</strong> cada membro acessa o próprio extrato, débitos e histórico.</li>
        </ul>
      </Section>

      <Section id="assinatura" n={5} title="Assinatura e cobrança">
        <p>
          A loja paga ao Sigma Horus pela plataforma (assinatura), e isso é diferente das cobranças que a loja faz aos
          seus membros (essas caem direto na conta da loja, pelo gateway que ela conecta). Os planos são por faixa de
          obreiros ativos:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Oficina</strong> — até 30 membros — R$ 60,00/mês.</li>
          <li><strong>Loja</strong> — 31 a 80 membros — R$ 90,00/mês.</li>
          <li><strong>Potência</strong> — 81+ ou multiloja — R$ 180,00/mês.</li>
        </ul>
        <p>Formas de contratação:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Mensal no cartão:</strong> cobrança recorrente todo mês.</li>
          <li><strong>Anual no cartão:</strong> 12 meses, com renovação automática (sem desconto).</li>
          <li><strong>Anual no boleto:</strong> pago de uma vez, com <strong>10% de desconto</strong>. O acesso é liberado <strong>após a confirmação</strong> do pagamento.</li>
        </ul>
        <p className="text-sm text-sand-dark">
          O <strong>período de teste de 10 dias</strong> é gratuito e não gera cobrança: nada é debitado até você
          contratar um plano.
        </p>
      </Section>

      <Section id="regras" n={6} title="Reembolso, upgrade e downgrade">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Sem reembolso:</strong> após a contratação não há devolução de valores já pagos do período vigente.</li>
          <li><strong>Upgrade (subir de plano):</strong> vale <strong>imediatamente</strong>, no ato da contratação do novo plano, com cobrança proporcional da diferença.</li>
          <li><strong>Downgrade (descer de plano):</strong> passa a valer <strong>somente ao fim do período já contratado</strong>. Você mantém o plano atual até lá; nada é devolvido.</li>
        </ul>
        <p>Você gerencia tudo isso na área <em>Assinatura</em> do painel.</p>
      </Section>

      <Section id="juridico" n={7} title="Privacidade, segurança e questões jurídicas">
        <p>
          O Sigma Horus é <strong>software</strong> de gestão; não é instituição financeira nem custodia valores. Os
          dados de cada loja são isolados (Row-Level Security), trafegam cifrados (TLS) e o acesso é por papel. Toda
          alteração relevante fica registrada na auditoria.
        </p>
        <p>
          No tratamento de dados pessoais, em regra a <strong>loja é a controladora</strong> (decide finalidade e meios) e o
          Sigma Horus atua como <strong>operador</strong>. Use os dados dos obreiros com base legal e finalidade legítima,
          conforme a LGPD.
        </p>
        <p>
          Para os detalhes completos, consulte os{' '}
          <a className="text-gold hover:text-gold-light" href="/termos">Termos de Uso</a>, a{' '}
          <a className="text-gold hover:text-gold-light" href="/privacidade">Política de Privacidade e LGPD</a> e a página de{' '}
          <a className="text-gold hover:text-gold-light" href="/compliance">Compliance &amp; Transparência</a>.
        </p>
      </Section>
    </LegalDoc>
  );
}
