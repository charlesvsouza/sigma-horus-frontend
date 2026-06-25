'use client';

export function BotaoExportar({ from, to }: { from?: string; to?: string }) {
  async function exportar() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/reports/export?${params.toString()}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={exportar}
      className="rounded-full border border-amber-400/40 px-5 py-2 text-sm text-amber-200 hover:bg-amber-400/10"
    >
      Exportar CSV
    </button>
  );
}
