'use client';

import { useEffect } from 'react';

// O <input type="date"> nativo aceita anos de mais de 4 dígitos (digitar "2026" e mais um número vira "20261-10-14").
// Em vez de corrigir campo a campo (clampDateYear), este guarda cobre TODOS os campos de data do sistema: se o ano passar
// de 4 dígitos, descarta a digitação (volta ao último valor bom) antes de o React ou o formulário enxergarem.
const YEAR_TOO_LONG = /^[+-]?\d{5,}-/;

export function DateYearGuard() {
  useEffect(() => {
    const last = new WeakMap<HTMLInputElement, string>();
    const isDate = (t: EventTarget | null): t is HTMLInputElement => t instanceof HTMLInputElement && t.type === 'date';

    function remember(e: Event) {
      if (isDate(e.target) && !YEAR_TOO_LONG.test(e.target.value)) last.set(e.target, e.target.value);
    }
    function guard(e: Event) {
      const el = e.target;
      if (!isDate(el)) return;
      if (YEAR_TOO_LONG.test(el.value)) {
        e.stopImmediatePropagation();
        el.value = last.get(el) ?? '';
        return;
      }
      last.set(el, el.value);
    }
    document.addEventListener('focusin', remember, true);
    document.addEventListener('input', guard, true);
    document.addEventListener('change', guard, true);
    return () => {
      document.removeEventListener('focusin', remember, true);
      document.removeEventListener('input', guard, true);
      document.removeEventListener('change', guard, true);
    };
  }, []);
  return null;
}
