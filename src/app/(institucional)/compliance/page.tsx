import type { Metadata } from 'next';
import { LegalDoc, Section } from '@/components/legal-doc';

export const metadata: Metadata = {
  title: 'Compliance & Transparência — Sigma Horus',
  description: 'Práticas de conformidade, segurança e transparência do Sigma Horus.',
};

export default function CompliancePage() {
  return (
    <LegalDoc
      eyebrow="Confiança"
      title="Compliance & Transparência"
      updatedAt="25 de junho de 2026"
      draftNotice
      intro={
        <>
          A confiança é a base de um sistema que cuida do dinheiro e dos dados de uma loja. Esta página reúne, de
          forma transparente, como tratamos segurança, conformidade e prestação de contas.
        </>
      }
    >
      <Section n={1} title="Segurança da informação">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Isolamento por loja:</strong> cada loja só enxerga seus próprios dados (Row-Level Security no banco).</li>
          <li><strong>Acesso por papel (RBAC):</strong> permissões granulares por cargo e por recurso, ajustáveis pela loja.</li>
          <li><strong>Criptografia:</strong> dados em trânsito por TLS; senhas com hash forte; chaves sensíveis cifradas.</li>
          <li><strong>Documentos privados:</strong> arquivos em bucket fechado, acessíveis só por links assinados temporários.</li>
        </ul>
      </Section>

      <Section n={2} title="Trilha de auditoria">
        <p>
          Toda operação relevante (criação, alteração e exclusão de registros financeiros e cadastrais) é gravada com
          autor, data/hora e detalhes — uma trilha imutável que dá rastreabilidade e apoia a prestação de contas ao fim
          de cada gestão.
        </p>
      </Section>

      <Section n={3} title="Separação de papéis no dinheiro">
        <p>
          O Sigma Horus é software e não retém valores. As cobranças aos membros são liquidadas diretamente na conta da
          loja, pelo Gateway que ela própria conecta. Essa separação evita conflito de interesse e mantém o controle do
          caixa com a loja.
        </p>
      </Section>

      <Section n={4} title="Conformidade com a LGPD">
        <p>
          Tratamos dados pessoais conforme a Lei nº 13.709/2018. Detalhes sobre bases legais, direitos do titular,
          retenção e contato do Encarregado estão na página de{' '}
          <a className="text-gold hover:text-gold-light" href="/privacidade">Privacidade & LGPD</a>.
        </p>
      </Section>

      <Section n={5} title="Disponibilidade e continuidade">
        <p>
          Mantemos backups periódicos do banco de dados e empregamos infraestrutura gerenciada com redundância.
          Buscamos comunicar com antecedência manutenções programadas que possam afetar o uso.
        </p>
      </Section>

      <Section n={6} title="Canal de transparência e denúncias">
        <p>
          Incidentes de segurança, vulnerabilidades ou condutas em desacordo com nossas práticas podem ser comunicados
          em <a className="text-gold hover:text-gold-light" href="mailto:compliance@sigmahorus.com.br">compliance@sigmahorus.com.br</a>.
          Apuramos as comunicações com confidencialidade e sem retaliação a quem reporta de boa-fé.
        </p>
      </Section>

      <Section n={7} title="Boas práticas recomendadas à loja">
        <ul className="list-disc space-y-2 pl-5">
          <li>Conceder a cada usuário apenas as permissões necessárias ao seu cargo.</li>
          <li>Revisar periodicamente quem tem acesso e remover usuários inativos.</li>
          <li>Usar senhas fortes e não compartilhar credenciais.</li>
          <li>Conferir os dados bancários e fiscais antes de emitir cobranças.</li>
        </ul>
      </Section>
    </LegalDoc>
  );
}
