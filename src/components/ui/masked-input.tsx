'use client';

import { InputHTMLAttributes, useRef } from 'react';

interface MaskedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (maskedValue: string) => void;
  mask: (raw: string) => string;
}

/**
 * Input com máscara (CPF/CNPJ/CEP/telefone/RG) que preserva a posição do
 * cursor ao reformatar. Sem isso, um input controlado que reescreve o valor
 * inteiro a cada tecla joga o cursor pro final — editar no MEIO de um valor
 * já preenchido (corrigir um dígito, por exemplo) embaralha os dígitos
 * seguintes, porque a próxima tecla cai no lugar errado. Reportado como
 * "digito um número e aparece outro" no CPF.
 */
export function MaskedInput({ value, onChange, mask, ...props }: MaskedInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const raw = el.value;
    const cursor = el.selectionStart ?? raw.length;
    const digitsBeforeCursor = (raw.slice(0, cursor).match(/\d/g) ?? []).length;
    const masked = mask(raw);
    onChange(masked);

    requestAnimationFrame(() => {
      if (!ref.current) return;
      let seen = 0;
      let pos = masked.length;
      for (let i = 0; i < masked.length; i++) {
        if (/\d/.test(masked[i])) {
          seen++;
          if (seen === digitsBeforeCursor) { pos = i + 1; break; }
        }
      }
      if (digitsBeforeCursor === 0) pos = 0;
      ref.current.setSelectionRange(pos, pos);
    });
  }

  return <input ref={ref} value={value} onChange={handleChange} {...props} />;
}
