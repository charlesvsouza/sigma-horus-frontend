import { ReactNode } from 'react';
import { Card, CardDescription, CardTitle } from './card';

// Card para formulários de "criar/editar registro" — largura de conteúdo
// (não estica até a borda da coluna) para o botão de envio e os campos não
// ficarem desproporcionais. Ver critique de 2026-09-06 (veneralato/contas/
// sessões/cobranças): o `<section>` sem largura própria + botão em
// `md:col-span-2` esticava até ~8x a largura natural do botão.
interface FormCardProps {
  title: string;
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FormCard({ title, description, headerAction, children, className = '' }: FormCardProps) {
  return (
    <Card className={`w-full max-w-2xl ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        {headerAction}
      </div>
      {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
      {children}
    </Card>
  );
}
