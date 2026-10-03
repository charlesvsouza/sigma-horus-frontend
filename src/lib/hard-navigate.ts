/**
 * Navegação completa (recarrega a página) para uma rota interna. Usada logo depois do login/troca de senha:
 * o cookie de sessão acabou de mudar e o servidor precisa renderizar o painel já com ele — uma navegação
 * "suave" do Next (router.push) poderia reaproveitar a árvore antiga. O destino é absoluto de propósito
 * (a regra de lint do Next recusa atribuir um caminho relativo a window.location).
 */
export function hardNavigate(path: string): void {
  window.location.assign(new URL(path, window.location.origin).toString());
}
