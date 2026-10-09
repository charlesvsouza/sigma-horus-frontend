import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc, Section } from '@/components/legal-doc';

export const metadata: Metadata = {
  title: 'Privacidade & LGPD',
  alternates: { canonical: '/privacidade' },
  description: 'Política de Privacidade do Sigma Horus: quais dados pessoais tratamos, para quê, com quem compartilhamos, por quanto tempo guardamos e como exercer seus direitos (LGPD).',
};

const A = 'text-gold hover:text-gold-light';

// TODO(jurídico): esta versão é MINUTA e precisa da revisão de advogado antes de a marca "minuta" sair.
// Pontos que a revisão deve olhar com atenção: (1) base legal dos dados que revelam filiação a organização
// filosófica (art. 5º, II e art. 11 da LGPD); (2) o cookie de origem de cadastro (consentimento x legítimo interesse);
// (3) a existência do DPA e a nomeação formal do Encarregado, afirmadas no texto.
export default function PrivacidadePage() {
  return (
    <LegalDoc
      eyebrow="Proteção de dados"
      title="Política de Privacidade e LGPD"
      updatedAt="5 de outubro de 2026 (versão 2.0)"
      draftNotice
      intro={
        <>
          Esta Política explica como o Sigma Horus coleta, usa, compartilha, guarda e protege dados pessoais, em
          conformidade com a Lei nº 13.709/2018 (LGPD). Os dados de cada loja ficam isolados dos de todas as outras e só
          são acessíveis por quem tem o cargo adequado dentro da própria loja. Não vendemos dados e não os usamos para
          publicidade.
        </>
      }
    >
      <Section n={1} title="Definições">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Loja:</strong> a loja maçônica que contrata o Sigma Horus para administrar seu cadastro, sua tesouraria e suas rotinas.</li>
          <li><strong>Irmão ou obreiro:</strong> pessoa cadastrada pela loja, com ou sem acesso ao portal.</li>
          <li><strong>Usuário:</strong> quem entra no sistema com e-mail e senha (Administrador, Venerável, Tesoureiro, Secretário, Hospitaleiro, irmão com acesso ao portal e demais cargos).</li>
          <li><strong>Titular:</strong> a pessoa a quem os dados pessoais se referem — o irmão, seus familiares cadastrados e os usuários.</li>
          <li><strong>Controlador, operador e suboperador:</strong> nos termos do art. 5º da LGPD; ver o item 2.</li>
          <li><strong>Dado pessoal sensível:</strong> o que a lei assim define (art. 5º, II), incluindo a filiação a organização de caráter filosófico.</li>
          <li><strong>ANPD:</strong> Autoridade Nacional de Proteção de Dados.</li>
        </ul>
      </Section>

      <Section n={2} title="Papéis no tratamento">
        <p>
          A <strong>loja</strong> é, em regra, a <em>controladora</em> dos dados de seus irmãos e de seus familiares (decide a
          finalidade e os meios). O <strong>Sigma Horus</strong> atua como <em>operador</em>: trata os dados em nome da loja,
          seguindo as instruções dela, para prestar o serviço. Para os dados de conta e de cobrança da própria loja (assinatura
          do sistema), o Sigma Horus atua como controlador.
        </p>
        <p className="mt-3">
          A relação entre a loja (controladora) e o Sigma Horus (operador) é formalizada por um
          <strong> Contrato de Tratamento de Dados (DPA)</strong>, disponível às lojas contratantes, que estabelece as
          instruções, as finalidades, as medidas de segurança e as responsabilidades de cada parte (art. 39 da LGPD).
        </p>
      </Section>

      <Section n={3} title="Dados que tratamos">
        <p>Os dados variam conforme o que a loja e o próprio irmão preenchem. Em geral:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Identificação e contato do irmão:</strong> nome, CPF, RG, data de nascimento, nacionalidade, estado civil, profissão, e-mail, telefone, endereço e foto.</li>
          <li><strong>Dados maçônicos:</strong> grau, rito, Potência, datas de iniciação, elevação e exaltação, loja de origem, cargos e situação (ativo, regularizado, entre outras).</li>
          <li><strong>Familiares:</strong> mãe, pai, cônjuge e dependentes (nome e, quando informados, data de nascimento, CPF, e-mail e telefone).</li>
          <li><strong>Financeiros:</strong> cobranças, mensalidades, pagamentos, comprovantes, acordos de regularização, contas a pagar e a receber e lançamentos.</li>
          <li><strong>Da vida da loja:</strong> presença em sessões, visitantes, documentos e pedidos à Hospitalaria, material emprestado e, quando houver, o processo de admissão de candidatos.</li>
          <li><strong>De uso e segurança:</strong> registros de acesso e trilha de auditoria (quem fez o quê e quando) e registros técnicos de erros do sistema.</li>
          <li><strong>Da loja:</strong> dados cadastrais, CNPJ e dados bancários ou chave Pix para cobranças e recibos.</li>
        </ul>
        <p className="mt-3">
          <strong>O que é essencial e o que é opcional.</strong> Para existir no cadastro o irmão precisa ter, no mínimo, o nome;
          CPF, e-mail e data de nascimento são necessários para cobrar, comunicar, aplicar benefícios por idade e celebrar
          aniversários, e o sistema avisa quando faltam. O restante é opcional. O irmão com acesso ao portal pode atualizar o
          próprio contato, endereço e família e preencher CPF e nascimento quando estiverem vazios; correções e retirada de
          dados já registrados são pedidas à Secretaria da loja.
        </p>
        <p className="mt-3">
          O serviço é destinado a maiores de 18 anos como usuários. Dados de crianças e adolescentes só entram como familiares
          cadastrados pela loja ou pelo irmão responsável (item 5).
        </p>
      </Section>

      <Section n={4} title="Dados sensíveis">
        <p>
          A filiação a uma organização de caráter filosófico é dado pessoal sensível (art. 5º, II, da LGPD), e por isso o grau,
          o rito, os cargos e a própria condição de irmão podem revelar uma convicção. A plataforma trata essas informações
          somente para a gestão da loja, restringe o acesso por cargo, registra tudo na auditoria e não as compartilha para
          fins alheios a essa finalidade.
        </p>
        <p className="mt-3">
          O tratamento de dados sensíveis só ocorre nas hipóteses do art. 11 da LGPD: em regra, com o <strong>consentimento
          específico e destacado</strong> do titular, colhido pela loja controladora ao admiti-lo e cadastrá-lo (art. 11, I), e,
          no que couber, para <strong>cumprimento de obrigação legal ou regulatória</strong> (art. 11, II, &quot;a&quot;) e para o
          <strong> exercício regular de direitos</strong>, inclusive em contrato e em processo judicial, administrativo ou
          arbitral (art. 11, II, &quot;d&quot;). O titular pode revogar o consentimento a qualquer tempo, ciente de que isso pode
          inviabilizar a manutenção do cadastro na loja.
        </p>
      </Section>

      <Section n={5} title="Dados de familiares e de terceiros">
        <p>
          Cada familiar cadastrado é, ele próprio, titular de dados. Por isso a loja ou o irmão que informa os dados de um
          familiar declara ter autorização dele para isso — e, no caso de criança ou adolescente, o consentimento de pelo menos
          um dos pais ou do responsável legal (art. 14 da LGPD). Os dados de familiares servem apenas à vida fraterna da loja:
          benefícios, felicitações de aniversário e jubileu e contato em situação de necessidade. Quem preferir que um familiar
          não receba felicitações pode pedir a marcação correspondente no cadastro.
        </p>
      </Section>

      <Section n={6} title="Finalidades e bases legais">
        <p>Tratamos dados para:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Executar o contrato com a loja e prestar o serviço de gestão (art. 7º, V, da LGPD).</li>
          <li>Cumprir obrigações legais e regulatórias, como as contábeis e fiscais (art. 7º, II).</li>
          <li>Exercer direitos em processo judicial, administrativo ou arbitral (art. 7º, VI).</li>
          <li>Atender ao legítimo interesse da loja e do Sigma Horus em administrar a loja e manter a segurança do sistema, sem sobrepor direitos do titular (art. 7º, IX).</li>
          <li>Quando aplicável, com o consentimento do titular (art. 7º, I), garantido o direito de não consentir e de revogar o consentimento a qualquer tempo (art. 8º, § 5º).</li>
        </ul>
        <p className="mt-3">
          Para os dados sensíveis, valem as bases do item 4. Não tomamos decisões exclusivamente automatizadas que afetem
          o titular.
        </p>
      </Section>

      <Section n={7} title="Compartilhamento">
        <p><strong>Dentro da loja.</strong> Os dados são visíveis apenas a quem a loja autoriza, de acordo com o cargo: cada cargo enxerga a sua área, e o irmão enxerga os próprios dados no portal. O quadro social e os documentos institucionais seguem a visibilidade que a loja define.</p>
        <p className="mt-3">
          <strong>Com suboperadores</strong>, sob contrato e dever de confidencialidade, apenas o necessário à prestação do serviço:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Vercel</strong> — hospedagem da aplicação e execução das funções.</li>
          <li><strong>Railway</strong> — banco de dados PostgreSQL gerenciado.</li>
          <li><strong>Cloudflare R2</strong> — armazenamento de documentos (privado) e de imagens como foto e brasão.</li>
          <li><strong>Stripe</strong> — processamento da assinatura da loja (dados de cobrança da plataforma).</li>
          <li><strong>Asaas</strong> (ou provedor de pagamentos equivalente conectado pela loja) — cobranças que a loja faz aos seus irmãos; os valores são liquidados diretamente à loja.</li>
          <li><strong>Resend</strong> — envio dos e-mails do sistema (cobranças, lembretes, convocações e avisos).</li>
        </ul>
        <p className="mt-3">Também podemos comunicar dados, na medida do necessário:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>a instituições financeiras e provedores de pagamento, para processar cobranças e recebimentos;</li>
          <li>a autoridades, por ordem judicial ou requisição de autoridade com competência legal;</li>
          <li>para a defesa de direitos em qualquer demanda, inclusive judicial;</li>
          <li>em operação societária ou reestruturação que envolva o Sigma Horus, quando necessária à continuidade do serviço, com aviso às lojas.</li>
        </ul>
        <p className="mt-3">A comunicação de dados de irmãos a federações, confederações ou à Potência é decisão da loja, como controladora, e não é feita pelo Sigma Horus por conta própria.</p>
      </Section>

      <Section n={8} title="Transferência internacional">
        <p>
          Alguns suboperadores podem processar dados em servidores fora do Brasil, notadamente nos <strong>Estados Unidos</strong>
          (Vercel, Cloudflare R2, Stripe, Resend) e eventualmente em outras jurisdições onde esses provedores mantêm
          infraestrutura. Nesses casos, a transferência observa a LGPD (art. 33), apoiando-se em:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Cláusulas contratuais padrão</strong> adotadas pelos provedores, quando aplicáveis;</li>
          <li><strong>Garantias contratuais</strong> de segurança e confidencialidade em nível compatível com a legislação brasileira;</li>
          <li><strong>Certificações e padrões internacionais</strong> de proteção de dados mantidos pelos suboperadores.</li>
        </ul>
      </Section>

      <Section n={9} title="Armazenamento e segurança">
        <p>
          Adotamos isolamento por loja com <em>Row-Level Security</em> no banco, criptografia em trânsito (TLS), senhas com hash
          forte (bcrypt), chaves sensíveis cifradas (AES-256-GCM), controle de acesso por cargo e trilha de auditoria
          de quem fez o quê e quando. Documentos ficam em bucket privado, acessíveis apenas por links assinados de curta duração.
          A foto do irmão e o brasão da loja ficam em armazenamento de acesso por link direto, para poderem aparecer nas telas,
          nos relatórios e nos e-mails. Mantemos backup diário e criptografado de toda a base, guardado por 30 dias.
        </p>
        <p className="mt-3">
          Realizamos internamente <strong>Relatórios de Impacto à Proteção de Dados (DPIA)</strong> para as operações de
          tratamento que apresentem alto risco aos titulares, conforme o art. 38 da LGPD.
        </p>
      </Section>

      <Section n={10} title="Deveres de quem usa o sistema">
        <p>
          Quem entra no sistema com um cargo passa a ter acesso a dados de outros titulares e, por isso, deve:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>usar os dados de outros irmãos e de seus familiares <strong>somente</strong> para as finalidades da loja;</li>
          <li>não compartilhá-los com terceiros para outros fins nem copiá-los para fora do sistema sem necessidade;</li>
          <li>não incluir dados de familiares ou de terceiros sem a autorização deles (item 5);</li>
          <li>manter a senha pessoal, sigilosa e intransferível, e avisar a loja se suspeitar de uso indevido;</li>
          <li>comunicar a Secretaria ou o Encarregado ao perceber dado incorreto ou acesso indevido.</li>
        </ul>
        <p className="mt-3">
          Todo acesso e toda alteração ficam registrados na auditoria. O uso indevido de dados ou de senha pode gerar
          responsabilização civil, penal e disciplinar, nos termos da lei e das regras da própria loja.
        </p>
      </Section>

      <Section n={11} title="Incidentes de segurança">
        <p>
          Em caso de incidente de segurança que possa acarretar risco relevante aos titulares, adotamos medidas de contenção e
          comunicamos as lojas afetadas em <strong>prazo razoável, preferencialmente em até 48 horas</strong> do conhecimento e,
          quando cabível, comunicamos à <strong>ANPD</strong> nos termos do art. 48 da LGPD. Também mantemos um monitoramento de
          falhas do sistema, que registra erros técnicos sem guardar o conteúdo das requisições.
        </p>
        <p className="mt-3">
          Vulnerabilidades podem ser reportadas confidencialmente a{' '}
          <a className={A} href="mailto:compliance@sigmahorus.com.br">compliance@sigmahorus.com.br</a>. Comprometemo-nos a acusar
          recebimento em até 48 horas úteis e a manter o reportante informado sobre as providências.
        </p>
      </Section>

      <Section n={12} title="Retenção e eliminação">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Enquanto a loja usar o serviço,</strong> os dados são mantidos para a gestão da loja.</li>
          <li><strong>Encerrada a relação,</strong> a loja pode exportar os dados. Passados <strong>90 dias</strong> do encerramento, os dados pessoais dos irmãos (nome, documentos, contatos) são anonimizados e os usuários de acesso são removidos.</li>
          <li><strong>Registros financeiros</strong> são preservados, sem identificar a pessoa, pelo prazo de guarda contábil e fiscal (cinco anos).</li>
          <li><strong>Backups</strong> são mantidos por 30 dias e depois descartados.</li>
          <li><strong>Dado opcional ou excessivo</strong> pode ser corrigido ou retirado pela loja a pedido do titular, salvo quando a lei exigir a guarda.</li>
        </ul>
      </Section>

      <Section n={13} title="Direitos do titular">
        <p>
          Nos termos da LGPD (art. 18), o titular dos dados pessoais tem os seguintes direitos, exercíveis perante a loja
          (controladora) e, quando couber, perante o Sigma Horus:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Confirmação da existência de tratamento;</li>
          <li>Acesso aos dados;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;</li>
          <li>Portabilidade dos dados a outro fornecedor de serviço, observados os segredos comercial e industrial;</li>
          <li>Eliminação dos dados tratados com consentimento (exceto nas hipóteses de guarda legal);</li>
          <li>Informação sobre as entidades públicas e privadas com as quais houve compartilhamento;</li>
          <li>Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa (art. 18, VIII);</li>
          <li>Oposição ao tratamento com base em legítimo interesse (art. 18, § 2º);</li>
          <li>Revisão de decisões automatizadas (art. 20), quando aplicável;</li>
          <li>Revogação do consentimento a qualquer tempo (art. 8º, § 5º).</li>
        </ul>
        <p className="mt-3">
          As solicitações dos irmãos devem ser dirigidas, em primeiro lugar, à <strong>loja</strong> (controladora), responsável
          primária pelo atendimento — em regra, pela Secretaria. O Sigma Horus dá o apoio técnico e operacional para que a loja
          atenda ao pedido no prazo legal; a confirmação de tratamento e o acesso aos dados em formato completo devem ser
          atendidos em até 15 dias (art. 19, II).
        </p>
        <p className="mt-3">
          O titular pode, ainda, peticionar diretamente à <strong>ANPD</strong> caso entenda que seus direitos não foram
          adequadamente atendidos (art. 18, § 1º, da LGPD).
        </p>
      </Section>

      <Section n={14} title="Cookies e tecnologias semelhantes">
        <p>
          A lista completa, com nome, finalidade e duração de cada um, está na <Link href="/cookies" className={A}>Política de Cookies</Link>. Em resumo:
        </p>
        <p className="mt-3">
          <strong>Cookies estritamente necessários.</strong> Usamos cookies e armazenamento local para o funcionamento da
          plataforma: sessão de login e segurança, e preferências de interface (como tema e menu lateral). Sem eles o login não
          funciona.
        </p>
        <p className="mt-3">
          <strong>Cookie de origem de cadastro.</strong> Quando você chega ao site por um link de divulgação (por exemplo, o QR
          Code de um folheto), guardamos por 90 dias, em um cookie próprio, apenas o nome do canal de origem. Ele serve só para
          sabermos de onde a loja veio quando ela se cadastra. Não identifica a pessoa, não acompanha a navegação em outros
          sites e não é compartilhado. Você pode bloqueá-lo ou apagá-lo nas configurações do navegador, sem prejuízo ao uso do
          sistema.
        </p>
        <p className="mt-3">
          <strong>Medição de acessos.</strong> Usamos uma ferramenta de medição de visitas das páginas públicas (Vercel Web
          Analytics) que funciona sem cookies e produz apenas números agregados. Não usamos cookies de publicidade nem de
          rastreamento entre sites.
        </p>
      </Section>

      <Section n={15} title="Links externos">
        <p>
          Alguns pontos do sistema podem levar a sites de terceiros, como o link de pagamento de um provedor de pagamentos ou a página da ANPD.
          Não somos responsáveis pelo conteúdo nem pelas práticas desses sites; recomendamos ler a política de privacidade de
          cada um antes de informar dados.
        </p>
      </Section>

      <Section n={16} title="Alterações desta Política">
        <p>
          Esta Política pode ser atualizada para refletir mudanças no serviço ou na lei. A data e a versão aparecem no topo da
          página. Quando a mudança for relevante, avisaremos as lojas por e-mail e pelo sistema, e a versão vigente ficará
          sempre disponível neste endereço.
        </p>
      </Section>

      <Section n={17} title="Encarregado (DPO) e contato">
        <p>
          O Sigma Horus nomeou um Encarregado de Dados, nos termos do art. 41 da LGPD, para atender titulares, orientar a loja
          e servir de ponto de contato com a ANPD.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>E-mail:</strong> <a className={A} href="mailto:privacidade@sigmahorus.com.br">privacidade@sigmahorus.com.br</a></li>
          <li><strong>Canal para lojas (DPA):</strong> <a className={A} href="mailto:compliance@sigmahorus.com.br">compliance@sigmahorus.com.br</a></li>
        </ul>
        <p className="mt-3">
          O titular que entender que seus direitos não foram adequadamente atendidos pode apresentar reclamação à
          <strong> Autoridade Nacional de Proteção de Dados (ANPD)</strong> pelo canal oficial em{' '}
          <a className={A} href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">www.gov.br/anpd</a>.
        </p>
      </Section>
    </LegalDoc>
  );
}
