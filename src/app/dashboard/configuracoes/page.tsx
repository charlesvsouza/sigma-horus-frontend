import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import ConfiguracoesClient from './ConfiguracoesClient';

const EMPTY: Record<string, string> = {
  name: '', legalName: '', tradeName: '', cnpj: '', email: '', phone: '',
  addressLine: '', addressNumber: '', neighborhood: '', city: '', state: '', zipCode: '',
  bankName: '', bankAgency: '', bankAccount: '', pixKey: '',
  riteName: '', powerName: '', sessionWeekdays: '', sessionFrequency: 'weekly',
};

// Server Component: carrega os dados cadastrais da loja para o formulário.
export default async function ConfiguracoesPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const lodge = lodgeId
    ? await withTenant(String(lodgeId), (db) =>
        db.lodge.findUnique({
          where: { id: String(lodgeId) },
          select: {
            name: true, legalName: true, tradeName: true, cnpj: true, email: true, phone: true,
            addressLine: true, addressNumber: true, neighborhood: true, city: true, state: true, zipCode: true,
            bankName: true, bankAgency: true, bankAccount: true, pixKey: true,
            riteName: true, powerName: true, sessionWeekdays: true, sessionFrequency: true,
          },
        }),
      )
    : null;

  const initialForm = { ...EMPTY };
  if (lodge) {
    for (const [k, v] of Object.entries(lodge)) initialForm[k] = (v ?? '') as string;
  }

  return <ConfiguracoesClient initialForm={initialForm} />;
}
