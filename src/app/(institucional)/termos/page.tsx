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
      updatedAt="26 de junho de 2026"
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
          <li><strong>Plataforma:</strong> o sistema Sigma Horus, em web e dispositivos móveis.</li>
          <li><strong>Loja / Cliente:</strong> a pessoa jurídica (loja maçônica) que assina o serviço.</li>
          <li><strong>Usuário:</strong> a pessoa autorizada pela loja a acessar a Plataforma (admin, tesoureiro, secretário, venerável, membro).</li>
          <li><strong>Gateway:</strong> o provedor de pagamentos (ex.: Asaas) conectado pela loja para cobrar seus membros.</li>
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
          <li><strong>Anual no boleto:</strong> pagamento único do período, pelo valor cheio (sem desconto). Nesta
            modalidade, o <strong>acesso é liberado apenas após a confirmação do pagamento</strong>, e não há renovação
            automática (a recontratação é manual ao fim do período).</li>
        </ul>
        <p>
          O não pagamento de cobrança recorrente pode suspender o acesso após aviso. Tributos aplicáveis são de
          responsabilidade de cada parte conforme a lei.
        </p>
      </Section>

      <Section n={6} title="Reembolso, upgrade e downgrade">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Sem reembolso:</strong> contratado um plano, <strong>não há devolução</strong> de valores já pagos
            referentes ao período vigente, seja em caso de cancelamento, downgrade ou inatividade.
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

      <Section n={7} title="Cobranças aos membros e lançamentos recorrentes">
        <p>
          A loja pode configurar cobranças recorrentes (ex.: mensalidades) e lançamentos automáticos. Ao habilitar a
          recorrência, a loja declara estar ciente de que novas cobranças serão geradas periodicamente conforme os
          parâmetros definidos, sob sua responsabilidade, e que pode revisá-las, pausá-las ou cancelá-las a qualquer tempo.
          A relação de cobrança é entre a loja e seus membros; o Sigma Horus apenas instrumentaliza a emissão e o controle.
        </p>
      </Section>

      <Section n={8} title="Obrigações da loja">
        <ul className="list-disc space-y-2 pl-5">
          <li>Usar os dados de membros conforme a LGPD, com base legal e finalidade legítima.</li>
          <li>Manter corretas as informações cadastrais, fiscais e bancárias.</li>
          <li>Conectar e operar o Gateway segundo as regras do próprio provedor.</li>
          <li>Não compartilhar credenciais nem permitir acessos não autorizados.</li>
        </ul>
      </Section>

      <Section n={9} title="Disponibilidade e suporte">
        <p>
          Empregamos esforços razoáveis para manter a Plataforma disponível e segura, com backups periódicos.
          Podem ocorrer interrupções para manutenção ou por fatores externos. O serviço é prestado &ldquo;no estado em
          que se encontra&rdquo;, sem garantia de operação ininterrupta.
        </p>
      </Section>

      <Section n={10} title="Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida em lei, o Sigma Horus não responde por danos indiretos ou lucros cessantes,
          nem por atos do Gateway, de instituições bancárias ou de terceiros. A responsabilidade eventual fica limitada
          ao valor pago pela loja nos 12 meses anteriores ao fato.
        </p>
      </Section>

      <Section n={11} title="Propriedade intelectual">
        <p>
          A marca, o código e o design da Plataforma pertencem ao Sigma Horus. Os dados inseridos pela loja
          permanecem de titularidade da loja, que pode exportá-los conforme a seção de Privacidade.
        </p>
      </Section>

      <Section n={12} title="Rescisão">
        <p>
          A loja pode cancelar a assinatura a qualquer tempo. Em caso de descumprimento destes Termos, o acesso pode
          ser suspenso ou encerrado. Após o encerramento, os dados são tratados conforme a política de retenção descrita
          na página de Privacidade.
        </p>
      </Section>

      <Section n={13} title="Alterações dos Termos">
        <p>
          Estes Termos podem ser atualizados. Mudanças relevantes serão comunicadas; o uso continuado após a vigência
          implica concordância com a nova versão.
        </p>
      </Section>

      <Section n={14} title="Lei aplicável e foro">
        <p>
          Aplica-se a legislação brasileira. Fica eleito o <strong>foro da Comarca da Capital do Estado do Rio de
          Janeiro</strong> para dirimir quaisquer controvérsias decorrentes destes Termos, com renúncia a qualquer outro,
          por mais privilegiado que seja, salvo disposição legal em contrário.
        </p>
      </Section>
    </LegalDoc>
  );
}
