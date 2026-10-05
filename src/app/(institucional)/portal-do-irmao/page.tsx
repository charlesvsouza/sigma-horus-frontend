import { moduleMetadata, ModulePageView } from '@/components/module-page-view';

// TODO(SEO): revisar texto — rascunho em lib/module-pages.ts.
export const metadata = moduleMetadata('portal-do-irmao');

export default function Page() {
  return <ModulePageView slug="portal-do-irmao" />;
}
