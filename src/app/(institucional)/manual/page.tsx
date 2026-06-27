import type { Metadata } from 'next';
import { ManualBook } from '@/components/manual-book';

export const metadata: Metadata = {
  title: 'Manual do Usuário — Sigma Horus',
  description:
    'Guia completo do Sigma Horus: primeiros passos, papéis de acesso, e o passo a passo de cada perfil — Administrador (incl. conexão do Asaas), Tesoureiro, Secretário, Venerável e Membro. Com índice lateral e exportação em PDF.',
};

export default function ManualPage() {
  return <ManualBook />;
}
