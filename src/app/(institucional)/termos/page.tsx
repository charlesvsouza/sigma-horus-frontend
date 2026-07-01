import type { Metadata } from 'next';
import { LegalDoc, Section } from '@/components/legal-doc';

export const metadata: Metadata = {
  title: 'Termos de Uso — Sigma Horus',
  description: 'Condições de uso da plataforma Sigma Horus.',
};

export default function TermosPage() {
  return (
    <LegalDoc
      eyebrow="Jurídico"
      title="Termos de Uso"
      updatedAt="30 de junho de 2026"
      draftNotice
      intro={
        <>
          Estes Termos regem o uso da plataforma Sigma Horus (&ldquo;Plataforma&rdquo;). Ao criar uma conta,
          assinar um plano ou utilizar os serviços, a loja e seus usuários concordam com as condições abaixo.
        </>
      }
    >
      <Section n={1} title="Definições">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Plataforma:</strong> o sistema Sigma Horus, fornecido por meio do site <a className="text-gold hover:text-gold-light" href="https://sigmahorus.com.br" target="_blank" rel="noopener noreferrer">sigmahorus.com.br</a>, em web e dispositivos móveis.</li>
          <li><strong>Sigma Horus / Fornecedor:</strong> [razão social a inserir], inscrita no CNPJ sob nº [CNPJ a inserir], com sede na [endereço a inserir], e-mail <a className="text-gold hover:text-gold-light" href="mailto:contato@sigmahorus.com.br">contato@sigmahorus.com.br</a>.</li>
          <li><strong>Loja / Cliente:</strong> a pessoa jurídica (loja maçônica, associação civil sem fins lucrativos) que assina o serviço.</li>
          <li><strong>Usuário:</strong> a pessoa autorizada pela loja a acessar a Plataforma (admin, tesoureiro, secretário, venerável, membro).</li>
          <li><strong>Gateway:</strong> o provedor de pagamentos (ex.: Asaas) conectado pela loja para cobrar seus membros.</li>
          <li><strong>DPA (Data Processing Agreement):</strong> Contrato de Tratamento de Dados que formaliza a relação entre operador e controlador nos termos da LGPD, disponível mediante solicitação.</li>
        </ul>
      </Section>

      <Section n={2} title="Objeto e natureza do serviço">
        <p>
          O Sigma Horus fornece <em>software</em> de gestão administrativa e financeira. A Plataforma <strong>não</strong>
          é instituição financeira, meio de pagamento ou custodiante de valores. As cobranças aos membros são
          processadas pela conta da própria loja no Gateway, e os valores são liquidados diretamente à loja.
        </p>
      </Section>

      <Section n={3} title="Cadastro por convite, acesso e responsabilidade">
        <p>
          O cadastro de novas lojas é feito <strong>por convite</strong>: é necessário um código válido para criar a conta.
          O acesso depende de credenciais individuais. A loja é responsável por manter a confidencialidade das
          senhas, por definir os papéis de acesso de cada usuário e por todas as atividades realizadas em sua conta.
          O usuário compromete-se a fornecer informações verdadeiras e a não utilizar a Plataforma para fins ilícitos.
        </p>
      </Section>

      <Section n={4} title="Período de teste">
        <p>
          Toda nova loja conta com um <strong>período de teste de 10 (dez) dias</strong>, gratuito, no plano Oficina, com
          acesso às funcionalidades do plano. O teste <strong>não gera cobrança</strong>: nenhum valor é debitado durante
          esse período. Ao seu término, a loja deve contratar um dos planos para continuar utilizando a Plataforma; sem
          contratação, o acesso é pausado, preservando-se os dados conforme a política de retenção.
        </p>
      </Section>

      <Section n={5} title="Planos, assinatura e formas de pagamento">
        <p>
          A assinatura é contratada em planos por faixa de membros ativos (Oficina, Loja e Potência), com os valores
          informados no momento da contratação. As formas disponíveis são:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Mensal no cartão:</strong> cobrança recorrente mensal, com renovação automática.</li>
          <li><strong>Anual no cartão:</strong> cobrança anual com renovação automática e <strong>10% de desconto</strong>.</li>
          <li><strong>Anual no boleto:</strong> pagamento único do período, com <strong>5% de desconto</strong>. Nesta
            modalidade, o <strong>acesso é liberado apenas após a confirmação do pagamento</strong>, e não há renovação
            automática (a recontratação é manual ao fim do período).</li>
        </ul>
        <p>
          O não pagamento de cobrança recorrente pode suspender o acesso após aviso. Tributos aplicáveis são de
          responsabilidade de cada parte conforme a lei.
        </p>
      </Section>

      <Section n={6} title="Reajuste de preços">
        <p>
          Os valores dos planos podem ser reajustados periodicamente. Em caso de aumento, a loja será comunicada com
          <strong> antecedência mínima de 30 (trinta) dias</strong>. Se o reajuste for superior ao IPCA do período
          acumulado, a loja poderá cancelar a assinatura sem ônus até a vigência do novo valor. Assinaturas anuais
          em curso mantêm o valor contratado até o fim do ciclo.
        </p>
      </Section>

      <Section n={7} title="Reembolso, upgrade e downgrade">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Direito de arrependimento (CDC, art. 49):</strong> a loja pode desistir da contratação em até
            <strong> 7 (sete) dias corridos</strong> da data da contratação, sem qualquer ônus, com devolução integral
            dos valores pagos. O direito de arrependimento se aplica exclusivamente a contratações realizadas
            exclusivamente por meio digital (fora do estabelecimento comercial). O exercício do direito não impede
            nova contratação futura.
          </li>
          <li>
            <strong>Após o prazo de arrependimento:</strong> contratado um plano, <strong>não há devolução</strong> de
            valores já pagos referentes ao período vigente, seja em caso de cancelamento antecipado, downgrade ou
            inatividade, ressalvado o disposto no item anterior ou em lei.
          </li>
          <li>
            <strong>Upgrade:</strong> a mudança para um plano superior tem <strong>efeito imediato</strong>, no ato da
            contratação, com cobrança proporcional da diferença do período.
          </li>
          <li>
            <strong>Downgrade:</strong> a mudança para um plano inferior passa a valer <strong>somente ao término do
            período já contratado</strong>. Até lá, a loja mantém o plano atual, sem devolução de valores.
          </li>
        </ul>
      </Section>

      <Section n={8} title="Cobranças aos membros e lançamentos recorrentes">
        <p>
          A loja pode configurar cobranças recorrentes (ex.: mensalidades) e lançamentos automáticos. Ao habilitar a
          recorrência, a loja declara estar ciente de que novas cobranças serão geradas periodicamente conforme os
          parâmetros definidos, sob sua responsabilidade, e que pode revisá-las, pausá-las ou cancelá-las a qualquer tempo.
          A relação de cobrança é entre a loja e seus membros; o Sigma Horus apenas instrumentaliza a emissão e o controle.
        </p>
      </Section>

      <Section n={9} title="Obrigações da loja">
        <ul className="list-disc space-y-2 pl-5">
          <li>Usar os dados de membros conforme a LGPD, com base legal e finalidade legítima, atuando como controladora e responsabilizando-se pelo tratamento que realiza.</li>
          <li>Manter corretas as informações cadastrais, fiscais e bancárias.</li>
          <li>Conectar e operar o Gateway segundo as regras do próprio provedor.</li>
          <li>Não compartilhar credenciais nem permitir acessos não autorizados.</li>
          <li>Revisar periodicamente as permissões de acesso e remover usuários inativos.</li>
          <li>Informar os membros sobre o tratamento de seus dados na plataforma, nos termos da LGPD.</li>
        </ul>
        <p className="mt-3">
          A loja declara estar ciente de que a Política de Privacidade e LGPD, disponível em{' '}
          <a className="text-gold hover:text-gold-light" href="/privacidade">/privacidade</a>, é parte
          integrante destes Termos. Ao contratar, a loja adere às condições ali estabelecidas.
        </p>
      </Section>

      <Section n={10} title="Disponibilidade, SLA e suporte">
        <p>
          Empregamos esforços razoáveis para manter a Plataforma disponível e segura, com backups periódicos.
          Buscamos manter uma alta disponibilidade, com <strong>meta de 99,5%</strong> ao mês, excluídas interrupções
          para manutenção programada (comunicadas com antecedência), fatores externos fora de nosso controle (como
          falhas de terceiros ou ataques DDoS) e casos de força maior. Esta meta representa um compromisso de
          melhor esforço, não uma garantia contratual vinculante.
        </p>
        <p className="mt-3">
          O suporte técnico pode ser acionado pelo e-mail{' '}
          <a className="text-gold hover:text-gold-light" href="mailto:contato@sigmahorus.com.br">contato@sigmahorus.com.br</a>.
        </p>
      </Section>

      <Section n={11} title="Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida em lei, o Sigma Horus não responde por danos indiretos ou lucros cessantes,
          nem por atos do Gateway, de instituições bancárias ou de terceiros. A responsabilidade eventual por danos
          diretos comprovados, decorrentes da utilização da Plataforma, fica limitada ao valor pago pela loja nos
          12 (doze) meses anteriores ao fato.
        </p>
        <p className="mt-3">
          <strong>Esta limitação não se aplica</strong> em caso de dolo ou culpa grave, violação de dados pessoais
          por ação direta do Sigma Horus (responsabilidade solidária nos termos do art. 42, §1º LGPD), ou nas
          hipóteses em que a lei vedar a limitação antecipada de responsabilidade.
        </p>
      </Section>

      <Section n={12} title="Propriedade intelectual">
        <p>
          A marca, o código e o design da Plataforma pertencem ao Sigma Horus. Os dados inseridos pela loja
          permanecem de titularidade da loja, que pode exportá-los conforme a seção de Privacidade.
        </p>
      </Section>

      <Section n={13} title="Rescisão">
        <p>
          A loja pode cancelar a assinatura a qualquer tempo pela interface da Plataforma ou por e-mail.
          O cancelamento não gera reembolso de valores já pagos do período vigente, ressalvado o direito de
          arrependimento (Seção 6).
        </p>
        <p className="mt-3">
          Em caso de descumprimento destes Termos, o acesso pode ser suspenso ou encerrado, mediante notificação
          prévia sempre que possível.
        </p>
        <p className="mt-3">
          <strong>Após o encerramento:</strong> a loja poderá <strong>exportar seus dados</strong> (cadastros,
          financeiro, documentos) por meio da plataforma ou mediante solicitação, pelo prazo de
          <strong> 90 (noventa) dias</strong> contados do encerramento. Após esse prazo, os dados serão eliminados
          ou anonimizados, ressalvada a necessidade de retenção para cumprimento de obrigações legais (ex.: contábeis
          e fiscais), conforme a política de retenção descrita na página de Privacidade.
        </p>
      </Section>

      <Section n={14} title="Alterações dos Termos">
        <p>
          Estes Termos podem ser atualizados. Mudanças relevantes serão comunicadas; o uso continuado após a vigência
          implica concordância com a nova versão.
        </p>
      </Section>

      <Section n={15} title="Lei aplicável, foro e mediação">
        <p>
          Aplica-se a <strong>legislação brasileira</strong>, em especial a Lei nº 10.406/2002 (Código Civil), a
          Lei nº 8.078/1990 (Código de Defesa do Consumidor, quando aplicável) e a Lei nº 13.709/2018 (LGPD).
        </p>
        <p className="mt-3">
          Fica eleito o <strong>foro da Comarca da Capital do Estado do Rio de Janeiro</strong> para dirimir as
          controvérsias decorrentes destes Termos, com renúncia a qualquer outro por mais privilegiado que seja.
          <strong> Tratando-se de relação de consumo</strong>, a loja poderá optar pelo foro de seu próprio domicílio,
          nos termos do art. 101, I, do CDC.
        </p>
        <p className="mt-3">
          Como alternativa ao litígio judicial, as partes poderão recorrer à <strong>mediação</strong> como método
          extrajudicial de solução de controvérsias, sem prejuízo do acesso ao Judiciário.
        </p>
      </Section>
    </LegalDoc>
  );
}
