import { Order, Installment, Customer } from '../types';
import { supabase } from './supabase';

const ASAAS_API_KEY = import.meta.env.VITE_ASAAS_API_TOKEN;
const ASAAS_BASE_URL = 'https://api.asaas.com/v3';

export const asaasService = {
  /**
   * Cria uma cobrança PIX no Asaas.
   */
  async createPixCharge(order: Order, installment: Installment, customerData: { name: string, email: string, phone: string, document?: string }) {
    try {
      if (!ASAAS_API_KEY) throw new Error('Token do Asaas não configurado.');

      // 1. Procurar ou Criar Cliente no Asaas
      let asaasCustomerId = '';
      
      const cpfCnpj = (customerData.document || '00000000000').replace(/\D/g, '');
      const email = customerData.email && customerData.email.includes('@') ? customerData.email : 'nao-informado@gmail.com';
      let phone = (customerData.phone || '').replace(/\D/g, '');
      
      // Buscar se cliente já existe no asaas pelo cpf
      const searchCustomerRes = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${cpfCnpj}`, {
        method: 'GET',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      const searchCustomerData = await searchCustomerRes.json();
      
      if (searchCustomerData.data && searchCustomerData.data.length > 0) {
        asaasCustomerId = searchCustomerData.data[0].id;
      } else {
        // Criar cliente
        const createCustomerRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
          method: 'POST',
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: customerData.name || 'Cliente RTC',
            cpfCnpj: cpfCnpj,
            email: email,
            phone: phone.substring(0, 11)
          })
        });
        const createCustomerData = await createCustomerRes.json();
        if (createCustomerRes.ok && createCustomerData.id) {
          asaasCustomerId = createCustomerData.id;
        } else {
          throw new Error('Falha ao criar cliente no Asaas: ' + JSON.stringify(createCustomerData.errors));
        }
      }

      // 2. Criar Cobrança PIX
      const dueDate = installment.dueDate || new Date().toISOString().split('T')[0];
      const payload = {
        customer: asaasCustomerId,
        billingType: 'PIX',
        value: installment.value,
        dueDate: dueDate,
        description: `RTC - Pedido ${order.contractNumber || order.id.slice(0, 8)} - Parc ${installment.number}`,
        externalReference: `${order.id}_${installment.id}`
      };

      const paymentRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const paymentData = await paymentRes.json();
      if (!paymentRes.ok || !paymentData.id) {
        throw new Error('Erro ao gerar cobrança PIX no Asaas: ' + JSON.stringify(paymentData.errors));
      }
      
      const paymentId = paymentData.id;
      const paymentLink = paymentData.invoiceUrl;

      // 3. Pegar Payload do PIX QrCode
      const pixRes = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/pixQrCode`, {
        method: 'GET',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      const pixData = await pixRes.json();
      
      if (!pixRes.ok || !pixData.success) {
         throw new Error('Erro ao buscar QR Code PIX no Asaas: ' + JSON.stringify(pixData.errors));
      }

      return {
        type: 'PIX',
        url: paymentLink,
        id: paymentId,
        pixCode: pixData.payload, // O Copia e Cola
      };
    } catch (err: any) {
      console.error('AsaasService Error:', err);
      throw err;
    }
  },

  /**
   * Consulta o status de um pagamento no Asaas.
   */
  async checkStatus(paymentId: string) {
    try {
      if (!paymentId || !paymentId.startsWith('pay_')) return 'PENDING';
      
      const response = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return 'PENDING';
      }
      
      const result = await response.json();
      
      if (result.status === 'RECEIVED' || result.status === 'CONFIRMED' || result.status === 'RECEIVED_IN_CASH') {
        return 'PAID';
      }
      return 'PENDING';
    } catch (err: any) {
      console.error('Asaas CheckStatus Error:', err);
      throw err;
    }
  }
};
