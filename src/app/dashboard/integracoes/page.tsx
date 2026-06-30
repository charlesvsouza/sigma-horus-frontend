import { auth } from '@/lib/auth';
import { decryptSecret, maskSecret } from '@/lib/crypto';
import { buildLodgeChannels, LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { channelsAvailable } from '@/lib/messaging';
import { withTenant } from '@/lib/prisma';
import IntegracoesClient from './IntegracoesClient';

// Server Component: status das integrações (Asaas + Comunicação) no servidor.
export default async function IntegracoesPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  const lodge = lodgeId
    ? await withTenant(String(lodgeId), (db) =>
        db.lodge.findUnique({
          where: { id: String(lodgeId) },
          select: { asaasApiKeyEnc: true, asaasEnv: true, asaasWebhookToken: true, ...LODGE_MESSAGING_SELECT },
        }),
      )
    : null;

  const apiKey = decryptSecret(lodge?.asaasApiKeyEnc);
  const asaas = {
    configured: Boolean(apiKey),
    env: lodge?.asaasEnv ?? 'sandbox',
    maskedKey: apiKey ? maskSecret(apiKey) : null,
    hasWebhookToken: Boolean(lodge?.asaasWebhookToken),
    webhookUrl: '/api/asaas/webhook',
  };

  const avail = channelsAvailable(buildLodgeChannels(lodge));
  const messaging = {
    emailPlatform: avail.email,
    whatsapp: {
      configured: avail.whatsapp,
      phoneId: lodge?.whatsappPhoneId ?? null,
      template: lodge?.whatsappTemplate ?? null,
      lang: lodge?.whatsappTemplateLang ?? 'pt_BR',
    },
    sms: {
      configured: avail.sms,
      sid: lodge?.smsAccountSid ?? null,
      from: lodge?.smsFrom ?? null,
    },
  };

  return <IntegracoesClient asaas={asaas} messaging={messaging} />;
}
