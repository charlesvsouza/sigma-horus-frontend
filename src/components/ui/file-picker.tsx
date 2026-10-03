'use client';

import { useRef } from 'react';

// Seletor de arquivo no idioma da interface: o <input type="file"> nativo mostra "Choose File / No file chosen"
// no idioma do navegador (inglês na maioria dos aparelhos), o que destoa do resto do sistema e tem alvo
// de toque pequeno. O input real fica escondido (continua acessível por teclado e leitor de tela) e o botão
// abre o seletor. `fileNames` vem do pai, para o texto acompanhar o que foi escolhido (e limpar depois do envio).
export function FilePicker({
  accept,
  multiple = false,
  disabled = false,
  ariaLabel,
  buttonLabel = 'Escolher arquivo',
  emptyLabel = 'Nenhum arquivo escolhido',
  fileNames = [],
  onFiles,
  inputRef,
}: {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  buttonLabel?: string;
  emptyLabel?: string;
  fileNames?: string[];
  onFiles: (files: File[]) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const own = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? own;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={ref}
        type="file"
        className="sr-only"
        aria-label={ariaLabel}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-sigma-blue-deep transition-colors hover:bg-gold-light focus-visible:ring-2 focus-visible:ring-gold/60 disabled:opacity-40"
      >
        {buttonLabel}
      </button>
      <span className="min-w-0 break-words text-sm text-sand-dark">
        {fileNames.length === 0 ? emptyLabel : fileNames.length === 1 ? fileNames[0] : `${fileNames.length} arquivos escolhidos`}
      </span>
    </div>
  );
}
