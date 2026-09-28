'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-[#0A1628] px-5 py-2 font-medium text-white transition-colors hover:bg-[#1c2c45]"
    >
      Imprimir / PDF
    </button>
  );
}
