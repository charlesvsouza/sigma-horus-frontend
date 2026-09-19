import { ReactNode } from 'react';

// Rótulo visível para campos de formulário (input/select/textarea). O <label> envolve o
// campo, então a associação é implícita (leitor de tela) e o texto não some ao preencher,
// como acontecia quando o placeholder fazia o papel de rótulo.
interface FieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, children, className = '' }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-sand-dark">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
