import { moduleMetadata, ModulePageView } from '@/components/module-page-view';

// TODO(SEO): revisar texto — rascunho em lib/module-pages.ts.
export const metadata = moduleMetadata('controle-de-mensalidades');

export default function Page() {
  return <ModulePageView slug="controle-de-mensalidades" />;
}
