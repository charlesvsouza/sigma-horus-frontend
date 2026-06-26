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
      updatedAt="25 de junho de 2026"
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
      </Section>

      <Section n={2} title="Dados que tratamos">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Cadastrais de membros:</strong> nome, contato, documentos, dados maçônicos (grau, datas, cargos).</li>
          <li><strong>Financeiros:</strong> cobranças, pagamentos, contas a pagar/receber, lançamentos.</li>
          <li><strong>De uso:</strong> logs de acesso e auditoria de operações (quem fez o quê e quando).</li>
          <li><strong>Da loja:</strong> dados cadastrais, fiscais (CNPJ) e bancários para cobranças e recibos.</li>
        </ul>
      </Section>

      <Section n={3} title="Finalidades e bases legais">
        <p>Tratamos dados para:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Executar o contrato e prestar o serviço de gestão (art. 7º, V, LGPD).</li>
          <li>Cumprir obrigações legais e regulatórias (art. 7º, II).</li>
          <li>Atender ao legítimo interesse de gestão e segurança, sem sobrepor direitos do titular (art. 7º, IX).</li>
          <li>Quando aplicável, mediante consentimento do titular (art. 7º, I).</li>
        </ul>
      </Section>

      <Section n={4} title="Compartilhamento">
        <p>
          Compartilhamos dados apenas com operadores necessários ao serviço — por exemplo, o Gateway de pagamentos
          conectado pela loja (Asaas), provedores de infraestrutura e armazenamento (hospedagem, banco de dados,
          storage de documentos) e o processador de assinaturas (Stripe). Não vendemos dados pessoais.
        </p>
      </Section>

      <Section n={5} title="Armazenamento e segurança">
        <p>
          Adotamos isolamento por loja com <em>Row-Level Security</em> no banco, criptografia em trânsito (TLS),
          senhas com hash forte, controle de acesso por papel (RBAC) e trilha de auditoria. Documentos ficam em
          bucket privado, acessíveis apenas por links assinados de curta duração.
        </p>
      </Section>

      <Section n={6} title="Retenção e eliminação">
        <p>
          Os dados são mantidos enquanto a loja utilizar o serviço e pelo prazo necessário ao cumprimento de obrigações
          legais (ex.: contábeis e fiscais). Encerrada a relação, os dados podem ser exportados pela loja e, em seguida,
          eliminados ou anonimizados conforme a política de retenção e a lei aplicável.
        </p>
      </Section>

      <Section n={7} title="Direitos do titular">
        <p>
          Nos termos da LGPD, o titular pode solicitar confirmação de tratamento, acesso, correção, anonimização,
          portabilidade, informação sobre compartilhamento e, quando cabível, eliminação dos dados. As solicitações de
          membros devem, em primeiro lugar, ser dirigidas à loja (controladora); o Sigma Horus dá apoio técnico para atendê-las.
        </p>
      </Section>

      <Section n={8} title="Cookies">
        <p>
          Utilizamos cookies estritamente necessários para autenticação e funcionamento (ex.: sessão de login). Não usamos
          cookies de publicidade. Você pode gerenciar cookies no navegador, ciente de que desabilitar os essenciais impede o login.
        </p>
      </Section>

      <Section n={9} title="Encarregado (DPO) e contato">
        <p>
          Para exercer direitos ou esclarecer dúvidas sobre privacidade, contate o Encarregado de Dados em{' '}
          <a className="text-gold hover:text-gold-light" href="mailto:privacidade@sigmahorus.com.br">privacidade@sigmahorus.com.br</a>.
        </p>
      </Section>
    </LegalDoc>
  );
}
