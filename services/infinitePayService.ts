import { Order, Installment } from '../types';
import { supabase } from './supabase';

const INFINITEPAY_BASE_URL = '/api/infinitepay-remote';

export const infinitePayService = {
  /**
   * Cria uma cobrança (Link ou PIX) na InfinitePay.
   */
  async createCharge(order: Order, installment: Installment, customerData?: { name: string, email: string, phone: string }) {
    try {
      // 1. Buscar Credenciais (Option A: Direto no front para teste)
      const { data: apiData, error: apiError } = await supabase
        .from('api_settings')
        .select('settings')
        .eq('service', 'infinitepay')
        .single();

      if (apiError || !apiData?.settings) {
        throw new Error('Configuração InfinitePay não encontrada no banco');
      }

      const { handle, apiKey } = apiData.settings;
      if (!handle) throw new Error('InfiniteTag (Handle) não configurada');

      // 2. Preparar Payload
      const amount = Math.round(installment.value * 100); // Em centavos
      const isPix = installment.paymentMethod?.toUpperCase().includes('PIX');
      
      let cleanPhone = (customerData?.phone || '').replace(/\D/g, '');
      if (cleanPhone && !cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
      if (cleanPhone) cleanPhone = '+' + cleanPhone;

      const payload: any = {
        handle: handle,
        items: [
          {
            quantity: 1,
            price: amount,
            description: `RTC - Pedido ${order.contractNumber || order.id.slice(0, 8)} - Parc ${installment.number}`
          }
        ],
        order_nsu: `${order.id}_${installment.id}`,
        redirect_url: `https://rtcweb.vercel.app/finance?orderId=${order.id}`,
        webhook_url: 'https://rtcweb.vercel.app/api/infinitepay-webhook',
        payment_methods: isPix ? ['pix'] : ['credit_card']
      };

      if (customerData) {
        payload.customer = {
          name: customerData.name,
          email: customerData.email,
          phone_number: cleanPhone
        };
      }

      // 3. Chamada Direta (CUIDADO: Se houver apiKey, ela será exposta no console de rede)
      const response = await fetch(`${INFINITEPAY_BASE_URL}/invoices/public/checkout/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-Api-Key': apiKey } : {})
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let result: any = {};
      try {
        result = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error('Resposta inválida da InfinitePay: ' + (text || 'Vazio'));
      }

      if (!response.ok) throw new Error(result.message || result.error || 'Erro ao gerar cobrança');

      console.log('InfinitePay API Result:', result);

      const url = result.url || result.checkout_url || '';
      
      // A V1 às vezes retorna apenas a URL. O slug é a última parte da URL.
      let paymentId = result.slug || result.id || result.invoice_slug || result.invoice_id;
      if (!paymentId && url) {
        const parts = url.split('/');
        paymentId = parts[parts.length - 1];
      }

      return {
        type: isPix ? 'PIX' : 'LINK',
        url: url,
        id: paymentId,
        pixCode: result.br_code || result.pix_code || result.emv || null,
      };
    } catch (err: any) {
      console.error('InfinitePayService Error:', err);
      throw err;
    }
  },

  /**
   * Cria uma cobrança Mestre (Link Único de Cartão) agrupando o saldo devedor do pedido.
   */
  async createMasterOrderCharge(order: Order, pendingInstallments: Installment[], customerData?: { name: string, email: string, phone: string }, maxInstallments?: number) {
    try {
      const { data: apiData } = await supabase.from('api_settings').select('settings').eq('service', 'infinitepay').single();
      const { handle } = apiData?.settings || {};
      if (!handle) throw new Error('InfiniteTag (Handle) não configurada');

      const totalAmount = pendingInstallments.reduce((acc, inst) => acc + inst.value, 0);
      const amount = Math.round(totalAmount * 100);
      
      let cleanPhone = (customerData?.phone || '').replace(/\D/g, '');
      if (cleanPhone && !cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
      if (cleanPhone) cleanPhone = '+' + cleanPhone;

      const payload: any = {
        handle: handle,
        items: [
          {
            quantity: 1,
            price: amount,
            description: `RTC - Pagamento Pedido ${order.contractNumber || order.id.slice(0, 8)}`
          }
        ],
        // NSU Pai (Sem _idParcela)
        order_nsu: order.id,
        redirect_url: `https://rtcweb.vercel.app/finance?orderId=${order.id}`,
        webhook_url: 'https://rtcweb.vercel.app/api/infinitepay-webhook',
        payment_methods: ['credit_card', 'pix']
      };

      // Tenta impor o limte de parcelas (O comportamento exato depende de como a CloudWalk interpreta no V1)
      if (maxInstallments) {
         payload.max_installments = maxInstallments;
         payload.installments = maxInstallments;
      }

      if (customerData) {
        payload.customer = {
          name: customerData.name,
          email: customerData.email,
          phone_number: cleanPhone
        };
      }

      console.log('PAYLOAD DA ÚLTIMA TENTATIVA DE LINK: ', JSON.stringify(payload, null, 2));

      const response = await fetch(`${INFINITEPAY_BASE_URL}/invoices/public/checkout/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const text = await response.text();
      let result: any = {};
      try { result = text ? JSON.parse(text) : {}; } catch (e) { throw new Error('Resposta inválida do gateway'); }

      if (!response.ok) throw new Error(result.message || result.error || 'Erro ao gerar cobrança unificada');

      const url = result.url || result.checkout_url || '';
      let paymentId = result.slug || result.id || result.invoice_slug || result.invoice_id;
      if (!paymentId && url) paymentId = url.split('/').pop();

      return {
        type: 'LINK',
        url: url,
        id: paymentId,
      };
    } catch (err: any) {
      console.error('InfinitePayService Master Order Error:', err);
      throw err;
    }
  },

  /**
   * Consulta o status de um pagamento na InfinitePay.
   */
  async checkStatus(paymentId: string, type: 'PIX' | 'LINK', orderId: string, installmentId: string) {
    try {
      // 1. Buscar Credenciais
      const { data: apiData } = await supabase
        .from('api_settings')
        .select('settings')
        .eq('service', 'infinitepay')
        .single();
      
      const { handle, apiKey } = apiData?.settings || {};
      if (!handle) return 'PENDING';

      const response = await fetch(`${INFINITEPAY_BASE_URL}/invoices/public/checkout/payment_check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-Api-Key': apiKey } : {})
        },
        body: JSON.stringify({
          handle,
          order_nsu: `${orderId}_${installmentId}`,
          slug: paymentId
        })
      });

      const text = await response.text();
      
      console.log(`InfinitePay CheckStatus - Status HTTP: ${response.status}`, text);

      if (!response.ok) {
        throw new Error(`Falha na API da InfinitePay (HTTP ${response.status}): ${text}`);
      }
      
      if (!text) return 'PENDING';

      const result = JSON.parse(text);
      console.log('InfinitePay CheckStatus Result (JSON):', result);
      
      const isPaid = result.paid === true || result.status === 'paid' || result.status === 'APPROVED';
      if (!isPaid) {
          throw new Error(`[RESPOSTA INFINITEPAY - TIRE PRINT] Payload: ${text.substring(0, 300)}`);
      }
      
      return 'PAID';
    } catch (err: any) {
      console.error('InfinitePay CheckStatus Error:', err);
      throw err;
    }
  }
};
