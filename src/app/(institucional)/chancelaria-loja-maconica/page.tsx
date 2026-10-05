import { moduleMetadata, ModulePageView } from '@/components/module-page-view';

// TODO(SEO): revisar texto — rascunho em lib/module-pages.ts.
export const metadata = moduleMetadata('chancelaria-loja-maconica');

export default function Page() {
  return <ModulePageView slug="chancelaria-loja-maconica" />;
}
