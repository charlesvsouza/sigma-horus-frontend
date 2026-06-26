import type { Metadata } from 'next';
import { LegalDoc, Section } from '@/components/legal-doc';

export const metadata: Metadata = {
  title: 'Sobre — Sigma Horus',
  description: 'O que é o Sigma Horus, sua missão e a quem se destina.',
};

export default function SobrePage() {
  return (
    <LegalDoc
      eyebrow="Institucional"
      title="Sobre o Sigma Horus"
      intro={
        <>
          O Sigma Horus é uma plataforma de gestão administrativa e financeira para lojas maçônicas,
          com foco em tesouraria, cobrança e prestação de contas. O nome remete ao Olho de Hórus —
          símbolo de visão, proteção e precisão —, valores que guiam um sistema de contas no prumo.
        </>
      }
    >
      <Section n={1} title="Nossa proposta">
        <p>
          Reunir, em um único lugar, o que a tesouraria e a secretaria de uma loja precisam no dia a dia:
          cadastro de membros, cargos e períodos de veneralato; contas a pagar e a receber; emissão de
          cobranças e baixa automática; presença em sessões; relatórios gerenciais; fechamento de caixa;
          e uma trilha de auditoria completa.
        </p>
        <p>
          Tudo construído com isolamento de dados por loja (multi-tenant), segurança em primeiro lugar e
          uma interface moderna, pensada para funcionar bem no computador e no celular.
        </p>
      </Section>

      <Section n={2} title="A quem se destina">
        <p>
          A lojas maçônicas de qualquer rito ou potência que desejam profissionalizar a gestão financeira,
          dar transparência aos obreiros e reduzir o trabalho manual da tesouraria e da secretaria.
        </p>
      </Section>

      <Section n={3} title="Princípios">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Precisão:</strong> dados financeiros confiáveis, com auditoria de cada alteração.</li>
          <li><strong>Transparência:</strong> o obreiro acompanha sua própria situação; a gestão presta contas com clareza.</li>
          <li><strong>Privacidade:</strong> dados pessoais tratados conforme a LGPD, com acesso por papel.</li>
          <li><strong>Autonomia:</strong> cada loja conecta sua própria conta de cobrança; o dinheiro vai direto para a loja.</li>
        </ul>
      </Section>

      <Section n={4} title="Como o dinheiro funciona">
        <p>
          O Sigma Horus é um <em>software</em> de gestão — não é um meio de pagamento e não retém valores.
          As cobranças dos membros são emitidas pela conta da própria loja em um gateway (Asaas), e os
          valores caem diretamente na conta bancária da loja. A assinatura da plataforma é cobrada à parte,
          pela loja ao Sigma Horus.
        </p>
      </Section>

      <Section n={5} title="Contato">
        <p>
          Dúvidas, sugestões ou suporte: <a className="text-gold hover:text-gold-light" href="mailto:contato@sigmahorus.com.br">contato@sigmahorus.com.br</a>.
        </p>
      </Section>
    </LegalDoc>
  );
}
