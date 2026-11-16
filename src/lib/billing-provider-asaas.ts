import { AsaasApiError, createCustomer, createPayment, deletePayment, getPixQrCode, type AsaasConfig } from '@/lib/asaas';
import { asaasDueDate } from '@/lib/asaas-due-date';
import { BillingProviderError, type BillingProvider, type PixQr } from '@/lib/billing-provider';

// Adaptador do Asaas para o contrato de provedor. A ORDEM dos passos é a de sempre:
// cliente (cria se não existe) → cancela a cobrança anterior → cria a cobrança.
// O id do cliente novo só volta no resultado quando a cobrança foi criada (não grava cliente de emissão que falhou).

export function createAsaasProvider(config: AsaasConfig): BillingProvider {
  return {
    id: 'asaas',
    label: 'Asaas',

    async emit(input) {
      const { invoice, member, value, method, replaceExternalId } = input;
      try {
        let customerId = member.providerCustomerId;
        let created = false;
        if (!customerId) {
          const customer = await createCustomer(config, {
            name: member.name,
            email: member.email ?? undefined,
            cpfCnpj: member.cpf,
            phone: member.phone ?? undefined,
          });
          customerId = customer?.id ?? null;
          created = true;
        }
        if (!customerId) throw new BillingProviderError('Falha ao criar/obter o cliente no Asaas.', 502);

        // Reemissão: a cobrança anterior ainda existe no Asaas e poderia ser paga em duplicidade — cancela antes.
        if (replaceExternalId) {
          try {
            await deletePayment(config, replaceExternalId);
          } catch (error) {
            // Cobrança que já não existe no Asaas não impede a reemissão; qualquer outra falha sim —
            // seguir deixaria duas cobranças abertas para o mesmo irmão (pagamento em duplicidade).
            const message = error instanceof Error ? error.message : String(error);
            if (!/404|not.?found|n[ãa]o.?encontr/i.test(message)) {
              throw new BillingProviderError(`Não foi possível cancelar a cobrança anterior no Asaas: ${message}. Tente de novo.`, 502);
            }
          }
        }

        const payment = await createPayment(config, {
          customer: customerId,
          billingType: method,
          value,
          dueDate: asaasDueDate(invoice.dueDate),
          description: invoice.description ?? `Cobrança ${invoice.number}`,
          externalReference: invoice.id,
        });
        return {
          externalId: payment?.id ?? null,
          invoiceUrl: payment?.invoiceUrl ?? null,
          bankSlipUrl: payment?.bankSlipUrl ?? null,
          newProviderCustomerId: created ? customerId : null,
          raw: payment,
        };
      } catch (err) {
        if (err instanceof BillingProviderError) throw err;
        throw new BillingProviderError(
          err instanceof Error ? err.message : 'Erro ao emitir cobrança no Asaas.',
          502,
          err instanceof AsaasApiError ? err.code : null,
        );
      }
    },

    async fetchPixQr(externalId): Promise<PixQr | null> {
      try {
        const qr = await getPixQrCode(config, externalId);
        return qr?.payload ? { payload: qr.payload, encodedImage: qr.encodedImage } : null;
      } catch {
        return null;
      }
    },
  };
}
