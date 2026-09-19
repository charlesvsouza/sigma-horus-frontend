import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import ConfiguracoesClient from './ConfiguracoesClient';
import { normalizeBillingChoice, normalizeCollectionMode } from '@/lib/collection';

const EMPTY: Record<string, string> = {
  name: '', legalName: '', tradeName: '', cnpj: '', email: '', phone: '', crestUrl: '',
  addressLine: '', addressNumber: '', neighborhood: '', city: '', state: '', zipCode: '',
  bankName: '', bankAgency: '', bankAccount: '', pixKey: '',
  riteName: '', powerName: '', foundationDate: '', sessionWeekdays: '', sessionFrequency: 'weekly',
  expenseApprovalThreshold: '', lateFeePercent: '', lateInterestPercentMonth: '',
  autoBalanceteEnabled: 'false', art002Enabled: 'true',
  notifyBirthdaysEnabled: 'true', notifyMilestonesEnabled: 'true', notifyBillingRemindersEnabled: 'true',
  notifyFoundationAnniversaryEnabled: 'true',
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
            name: true, legalName: true, tradeName: true, cnpj: true, email: true, phone: true, crestUrl: true,
            addressLine: true, addressNumber: true, neighborhood: true, city: true, state: true, zipCode: true,
            bankName: true, bankAgency: true, bankAccount: true, pixKey: true,
            riteName: true, powerName: true, foundationDate: true, sessionWeekdays: true, sessionFrequency: true,
            expenseApprovalThreshold: true, lateFeePercent: true, lateInterestPercentMonth: true,
            autoBalanceteEnabled: true, art002Enabled: true,
            notifyBirthdaysEnabled: true, notifyMilestonesEnabled: true, notifyBillingRemindersEnabled: true,
            notifyFoundationAnniversaryEnabled: true,
          },
        }),
      )
    : null;

  // Recebimento das cobranças (Modo Loja / Modo Asaas) + contas correntes elegíveis ao repasse.
  const collectionData = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        lodge: await db.lodge.findUnique({
          where: { id: String(lodgeId) },
          select: { collectionMode: true, asaasSettlementAccountId: true, asaasBillingType: true, asaasApiKeyEnc: true, pixKey: true, bankName: true, bankAccount: true },
        }),
        accounts: await db.financialAccount.findMany({
          where: { lodgeId: String(lodgeId), active: true, kind: 'bank', isInvestment: false, purpose: 'general' },
          select: { id: true, name: true },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        }),
      }))
    : null;
  const collection = {
    mode: normalizeCollectionMode(collectionData?.lodge?.collectionMode),
    settlementAccountId: collectionData?.lodge?.asaasSettlementAccountId ?? '',
    billingType: normalizeBillingChoice(collectionData?.lodge?.asaasBillingType),
    asaasConnected: Boolean(collectionData?.lodge?.asaasApiKeyEnc),
    hasPaymentData: Boolean(collectionData?.lodge?.pixKey || collectionData?.lodge?.bankAccount),
    accounts: collectionData?.accounts ?? [],
  };

  const initialForm = { ...EMPTY };
  if (lodge) {
    for (const [k, v] of Object.entries(lodge)) {
      initialForm[k] = v == null ? '' : k === 'foundationDate' && v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    }
  }

  return <ConfiguracoesClient initialForm={initialForm} collection={collection} />;
}
