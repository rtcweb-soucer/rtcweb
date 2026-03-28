import { Order, Installment } from '../types';

export const infinitePayService = {
  /**
   * Cria uma cobrança (Link ou PIX) na InfinitePay.
   */
  async createCharge(order: Order, installment: Installment, maxInstallments?: number) {
    try {
      // Valor em centavos
      const amount = Math.round(installment.value * 100);
      const isPix = installment.paymentMethod?.toUpperCase().includes('PIX');

      const response = await fetch('/api/infinitepay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description: `RTC - Pedido #${order.contractNumber || order.id.slice(0, 8)} - Parc ${installment.number}`,
          paymentMethod: isPix ? 'PIX' : 'LINK',
          maxInstallments: maxInstallments || order.cardInstallments || 12
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao gerar cobrança InfinitePay');

      return data;
    } catch (err) {
      console.error('InfinitePayService Error:', err);
      throw err;
    }
  },

  /**
   * Consulta o status de um pagamento na InfinitePay.
   */
  async checkStatus(paymentId: string, type: 'PIX' | 'LINK') {
    try {
      const response = await fetch(`/api/infinitepay?paymentId=${paymentId}&type=${type}`);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Erro ao consultar status InfinitePay');
      
      return data.status; // Retorna 'PAID' ou 'PENDING'
    } catch (err) {
      console.error('InfinitePay CheckStatus Error:', err);
      return 'PENDING';
    }
  }
};
