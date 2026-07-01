import type { Metadata } from 'next';
import { LegalDoc, Section } from '@/components/legal-doc';

export const metadata: Metadata = {
  title: 'Privacidade & LGPD — Sigma Horus',
  description: 'Como o Sigma Horus trata dados pessoais conforme a LGPD.',
};

export default function PrivacidadePage() {
  return (
    <LegalDoc
      eyebrow="Proteção de dados"
      title="Política de Privacidade e LGPD"
      updatedAt="30 de junho de 2026"
      draftNotice
      intro={
        <>
          Esta Política explica como o Sigma Horus coleta, usa, compartilha e protege dados pessoais, em
          conformidade com a Lei nº 13.709/2018 (LGPD). Levamos a privacidade dos obreiros a sério: dados
          são isolados por loja e acessíveis apenas por quem tem o papel adequado.
        </>
      }
    >
      <Section n={1} title="Papéis no tratamento">
        <p>
          A <strong>loja</strong> é, em regra, a <em>controladora</em> dos dados de seus membros (decide finalidade e meios).
          O <strong>Sigma Horus</strong> atua como <em>operador</em>, tratando os dados em nome da loja para prestar o serviço.
          Para os dados de conta e cobrança da própria loja, o Sigma Horus atua como controlador.
        </p>
        <p className="mt-3">
          A relação entre controladora (loja) e operador (Sigma Horus) é formalizada por meio de um
          <strong> Contrato de Tratamento de Dados (DPA)</strong>, disponível às lojas contratantes, que estabelece
          as instruções, finalidades, medidas de segurança e responsabilidades de cada parte nos termos do art. 39 LGPD.
        </p>
      </Section>

      <Section n={2} title="Dados que tratamos">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Cadastrais de membros:</strong> nome, contato, documentos, dados maçônicos (grau, ritos, datas, cargos, situação).</li>
          <li><strong>Financeiros:</strong> cobranças, pagamentos, contas a pagar/receber, lançamentos.</li>
          <li><strong>De uso:</strong> logs de acesso e auditoria de operações (quem fez o quê e quando).</li>
          <li><strong>Da loja:</strong> dados cadastrais, fiscais (CNPJ) e bancários para cobranças e recibos.</li>
        </ul>
        <p className="mt-3">
          <strong>Dados sensíveis:</strong> dados maçônicos (grau, rito, cargos, situação) podem, em certos contextos,
          revelar convicções filosóficas (art. 5º, II, LGPD). A plataforma adota proteção adicional para essas
          informações, tratando-as com finalidade legítima e específica — a gestão da loja — sem compartilhamento
          para fins alheios a essa finalidade.
        </p>
        <p className="mt-3">
          O serviço é destinado a maiores de 18 anos. Não tratamos intencionalmente dados de crianças ou adolescentes.
        </p>
      </Section>

      <Section n={3} title="Finalidades e bases legais">
        <p>Tratamos dados para:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Executar o contrato e prestar o serviço de gestão (art. 7º, V, LGPD, e art. 7º, IV — exercício regular de direitos em associação).</li>
          <li>Cumprir obrigações legais e regulatórias (art. 7º, II).</li>
          <li>Atender ao legítimo interesse de gestão e segurança, sem sobrepor direitos do titular (art. 7º, IX).</li>
          <li>Quando aplicável, mediante consentimento do titular (art. 7º, I), sendo garantido o direito de não consentir e de revogar o consentimento a qualquer tempo (art. 8º, §5º).</li>
        </ul>
        <p className="mt-3">
          O tratamento de dados maçônicos com potencial de revelar convicções filosóficas tem como base legal o
          art. 11, II, "a" e "b" da LGPD (obrigação legal e exercício regular de direitos em associação),
          dispensando consentimento específico por ser indispensável à própria existência e funcionamento da
          relação associativa.
        </p>
      </Section>

      <Section n={4} title="Compartilhamento e suboperadores">
        <p>
          Compartilhamos dados apenas com suboperadores necessários à prestação do serviço, sob contrato e dever de
          confidencialidade. Não vendemos dados pessoais nem os usamos para publicidade. Os principais suboperadores são:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Vercel</strong> — hospedagem da aplicação e execução das funções.</li>
          <li><strong>Railway</strong> — banco de dados PostgreSQL gerenciado e jobs.</li>
          <li><strong>Cloudflare R2</strong> — armazenamento privado de documentos.</li>
          <li><strong>Stripe</strong> — processamento da assinatura da loja (dados de cobrança da plataforma).</li>
          <li><strong>Asaas</strong> (ou gateway equivalente conectado pela loja) — cobranças que a loja faz aos seus membros; os valores são liquidados diretamente à loja.</li>
        </ul>
      </Section>

      <Section n={5} title="Transferência internacional">
        <p>
          Alguns suboperadores podem processar dados em servidores fora do Brasil, notadamente nos <strong>Estados Unidos</strong>
          (Vercel, Cloudflare R2, Stripe) e eventualmente em outras jurisdições onde esses provedores mantêm
          infraestrutura. Nesses casos, a transferência observa a LGPD (art. 33), apoiando-se em:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Cláusulas contratuais padrão (SCCs)</strong> adotadas pelos provedores, quando aplicáveis;</li>
          <li><strong>Garantias contratuais</strong> de segurança e confidencialidade em nível compatível com a legislação brasileira;</li>
          <li><strong>Certificações e padrões internacionais</strong> de proteção de dados mantidos pelos suboperadores.</li>
        </ul>
      </Section>

      <Section n={6} title="Armazenamento e segurança">
        <p>
          Adotamos isolamento por loja com <em>Row-Level Security</em> no banco, criptografia em trânsito (TLS),
          senhas com hash forte (bcrypt), chaves sensíveis cifradas (AES-256-GCM), controle de acesso por papel (RBAC) e
          trilha de auditoria imutável. Documentos ficam em bucket privado, acessíveis apenas por links assinados de
          curta duração. Mantemos backups periódicos do banco de dados.
        </p>
        <p className="mt-3">
          Realizamos internamente <strong>Relatórios de Impacto à Proteção de Dados (DPIA)</strong> para as operações
          de tratamento que apresentem alto risco aos titulares, conforme o art. 38 LGPD.
        </p>
      </Section>

      <Section n={7} title="Incidentes de segurança">
        <p>
          Em caso de incidente de segurança que possa acarretar risco relevante aos titulares, adotamos medidas de
          contenção e comunicamos as lojas afetadas em <strong>prazo razoável, preferencialmente em até 48 horas</strong>
          do conhecimento, e, quando cabível, comunicamos à <strong>ANPD</strong> nos termos do art. 48 LGPD.
        </p>
        <p className="mt-3">
          Vulnerabilidades podem ser reportadas confidencialmente a{' '}
          <a className="text-gold hover:text-gold-light" href="mailto:compliance@sigmahorus.com.br">compliance@sigmahorus.com.br</a>.
          Comprometemo-nos a acusar recebimento em até 48 horas úteis e a manter o reportante informado sobre as providências.
        </p>
      </Section>

      <Section n={8} title="Retenção e eliminação">
        <p>
          Os dados são mantidos enquanto a loja utilizar o serviço e pelo prazo necessário ao cumprimento de obrigações
          legais (ex.: contábeis e fiscais). Encerrada a relação, os dados podem ser exportados pela loja e, em seguida,
          eliminados ou anonimizados conforme a política de retenção e a lei aplicável.
        </p>
      </Section>

      <Section n={9} title="Direitos do titular">
        <p>
          Nos termos da LGPD (art. 18), o titular dos dados pessoais tem os seguintes direitos, exercíveis perante a
          loja (controladora) e, quando couber, perante o Sigma Horus:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Confirmação da existência de tratamento;</li>
          <li>Acesso aos dados;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;</li>
          <li>Portabilidade dos dados a outro fornecedor de serviço, observados os segredos comercial e industrial;</li>
          <li>Eliminação dos dados tratados com consentimento (exceto nas hipóteses de guarda legal);</li>
          <li>Informação sobre o compartilhamento e a finalidade;</li>
          <li>Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa (art. 7º, §3º);</li>
          <li>Oposição ao tratamento com base em legítimo interesse (art. 18, §2º);</li>
          <li>Revisão de decisões automatizadas (art. 20), quando aplicável;</li>
          <li>Revogação do consentimento a qualquer tempo (art. 8º, §5º).</li>
        </ul>
        <p className="mt-3">
          As solicitações de membros devem, em primeiro lugar, ser dirigidas à <strong>loja</strong> (controladora),
          que é a responsável primária pelo atendimento. O Sigma Horus dá apoio técnico e operacional para que a loja
          atenda as requisições no prazo legal.
        </p>
        <p className="mt-3">
          O titular pode, ainda, peticionar diretamente à <strong>ANPD</strong> caso entenda que seus direitos não
          foram adequadamente atendidos (art. 18, parágrafo único c/c art. 52, §3º LGPD).
        </p>
      </Section>

      <Section n={10} title="Cookies">
        <p>
          Utilizamos exclusivamente <strong>cookies estritamente necessários</strong> para autenticação e funcionamento
          da plataforma (ex.: sessão de login, preferência de tema, rail da sidebar). Não utilizamos cookies de
          publicidade, rastreamento ou analytics de terceiros que exijam consentimento.
        </p>
        <p className="mt-3">
          Por essa razão, a plataforma <strong>dispensa banner de consentimento de cookies</strong> (cookie wall),
          nos termos do art. 7º, III, LGPD c/c guia da ANPD sobre cookies e proteção de dados. Você pode gerenciar
          cookies nas configurações do navegador, ciente de que desabilitar os essenciais impede o funcionamento do login.
        </p>
      </Section>

      <Section n={11} title="Encarregado (DPO) e contato">
        <p>
          O Sigma Horus nomeou formalmente um Encarregado de Dados (DPO), nos termos do art. 41 LGPD, disponível para
          atender titulares, orientar a loja e servir de ponto de contato com a ANPD.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>E-mail:</strong> <a className="text-gold hover:text-gold-light" href="mailto:privacidade@sigmahorus.com.br">privacidade@sigmahorus.com.br</a></li>
          <li><strong>Canal para lojas (DPA):</strong> <a className="text-gold hover:text-gold-light" href="mailto:compliance@sigmahorus.com.br">compliance@sigmahorus.com.br</a></li>
        </ul>
        <p className="mt-3">
          O titular que entender que seus direitos não foram adequadamente atendidos pode apresentar reclamação à
          <strong> Autoridade Nacional de Proteção de Dados (ANPD)</strong> pelo canal oficial em{' '}
          <a className="text-gold hover:text-gold-light" href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">www.gov.br/anpd</a>.
        </p>
      </Section>
    </LegalDoc>
  );
}
