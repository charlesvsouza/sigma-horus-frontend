import Link from 'next/link';

// Aviso acima de uma lista com janela de histórico (lib/list-window): diz o que está sendo mostrado e
// oferece alternar entre "últimos 12 meses + em aberto" e "todo o histórico".
export default function HistoryWindowNote({ full, hidden, noun, basePath, inline = false }: { full: boolean; hidden: number; noun: string; basePath: string; inline?: boolean }) {
  if (!full && hidden === 0) return null;
  return (
    <p className={inline ? 'text-xs text-sand-dark' : 'mx-auto mt-4 max-w-6xl px-6 text-xs text-sand-dark'}>
      {full ? (
        <>Mostrando todo o histórico de {noun}. </>
      ) : (
        <>Mostrando o que está em aberto e os últimos 12 meses ({hidden.toLocaleString('pt-BR')} {noun} mais antigos ocultos). </>
      )}
      <Link href={full ? basePath : `${basePath}?historico=tudo`} className="font-medium text-gold hover:text-gold-light">
        {full ? 'Voltar aos últimos 12 meses' : 'Ver todo o histórico'}
      </Link>
    </p>
  );
}
