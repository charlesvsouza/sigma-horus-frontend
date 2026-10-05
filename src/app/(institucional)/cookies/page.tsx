import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc, Section } from '@/components/legal-doc';

export const metadata: Metadata = {
  title: 'Política de Cookies',
  alternates: { canonical: '/cookies' },
  description: 'Quais cookies e armazenamentos locais o Sigma Horus usa, para quê, por quanto tempo, e como bloqueá-los ou apagá-los no seu navegador.',
};

const A = 'text-gold hover:text-gold-light';

const ROWS: { name: string; kind: string; purpose: string; lasts: string; need: string }[] = [
  { name: 'authjs.session-token (ou __Secure-authjs.session-token)', kind: 'Cookie próprio', purpose: 'Mantém você conectado depois do login.', lasts: 'Até 30 dias, ou até sair.', need: 'Necessário' },
  { name: 'authjs.csrf-token e authjs.callback-url (com prefixo __Host- ou __Secure- em HTTPS)', kind: 'Cookie próprio', purpose: 'Segurança do login: protege contra requisições forjadas e lembra a página de destino.', lasts: 'Sessão do navegador.', need: 'Necessário' },
  { name: 'sigma-theme', kind: 'Armazenamento local', purpose: 'Lembra o tema (claro ou escuro) escolhido dentro do sistema.', lasts: 'Até você apagar os dados do navegador.', need: 'Preferência' },
  { name: 'sigma.sidebar.rail', kind: 'Armazenamento local', purpose: 'Lembra se o menu lateral está recolhido.', lasts: 'Até você apagar os dados do navegador.', need: 'Preferência' },
  { name: 'sh_src', kind: 'Cookie próprio', purpose: 'Guarda só o nome do canal de divulgação por onde você chegou ao site (por exemplo, o QR Code de um folheto), para sabermos de onde a loja veio quando ela se cadastrar.', lasts: '90 dias.', need: 'Opcional' },
];

export default function CookiesPage() {
  return (
    <LegalDoc
      eyebrow="Proteção de dados"
      title="Política de Cookies"
      updatedAt="5 de outubro de 2026 (versão 1.0)"
      draftNotice
      intro={
        <>
          Esta Política complementa a <Link href="/privacidade" className={A}>Política de Privacidade</Link> e explica, de forma
          direta, quais cookies e armazenamentos locais o Sigma Horus usa, para que servem e como você pode controlá-los.
          Não usamos cookies de publicidade nem de rastreamento entre sites.
        </>
      }
    >
      <Section n={1} title="O que são cookies">
        <p>
          Cookie é um pequeno arquivo que um site grava no seu navegador para lembrar algo entre uma visita e outra, como o fato de
          você já ter feito login. O <em>armazenamento local</em> do navegador cumpre papel parecido e guarda preferências na sua
          própria máquina. Em ambos os casos, o conteúdo fica no seu dispositivo.
        </p>
      </Section>

      <Section n={2} title="O que usamos">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm [&_td]:border-b [&_td]:border-white/6 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:border-b [&_th]:border-white/10 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-sand-light">
            <thead>
              <tr><th>Nome</th><th>Tipo</th><th>Para quê</th><th>Duração</th><th>Natureza</th></tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.name}><td className="break-words">{r.name}</td><td>{r.kind}</td><td>{r.purpose}</td><td>{r.lasts}</td><td>{r.need}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3">
          <strong>Medição de acessos.</strong> As páginas públicas usam uma ferramenta de medição de visitas (Vercel Web Analytics)
          que funciona sem cookies e produz apenas números agregados.
        </p>
        <p className="mt-3">
          Os cookies são <strong>próprios</strong> (definidos pelo Sigma Horus, não por terceiros) e não são compartilhados com
          nenhuma empresa de publicidade.
        </p>
      </Section>

      <Section n={3} title="Necessários, de preferência e opcionais">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Necessários:</strong> sem eles o login não funciona. Por isso não pedem consentimento.</li>
          <li><strong>De preferência:</strong> guardam escolhas de aparência. Sem eles o sistema funciona, só não lembra o que você escolheu.</li>
          <li><strong>Opcionais:</strong> o cookie de canal de divulgação serve apenas à medição do nosso alcance. Não identifica a pessoa e você pode recusá-lo sem perder nada no uso do sistema.</li>
        </ul>
      </Section>

      <Section n={4} title="Como bloquear ou apagar">
        <p>
          Você pode bloquear ou apagar cookies e dados de sites nas configurações do seu navegador (em geral em
          &quot;Privacidade&quot; ou &quot;Cookies e dados de sites&quot;), inclusive só os do Sigma Horus. Ao apagar o cookie de canal de
          divulgação nada muda para você. Ao bloquear os necessários, o login deixa de funcionar e algumas telas podem não abrir
          corretamente.
        </p>
      </Section>

      <Section n={5} title="Mudanças">
        <p>
          Se passarmos a usar outros cookies ou ferramentas de medição, atualizamos esta página antes, com nova data e versão, e
          pedimos o seu consentimento sempre que a lei exigir.
        </p>
      </Section>

      <Section n={6} title="Contato">
        <p>
          Dúvidas sobre cookies e privacidade: <a className={A} href="mailto:privacidade@sigmahorus.com.br">privacidade@sigmahorus.com.br</a>.
          Os direitos do titular e o contato do Encarregado estão na <Link href="/privacidade" className={A}>Política de Privacidade</Link>.
        </p>
      </Section>
    </LegalDoc>
  );
}
