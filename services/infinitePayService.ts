import { Order, Installment } from '../types';

export const infinitePayService = {
  async createCharge(order: Order, installment: Installment) {
    try {
      // Valor em centavos
      const amount = Math.round(installment.value * 100);
      const isPix = installment.paymentMethod?.toUpperCase().includes('PIX');

      const response = await fetch('/api/infinitepay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description: `RTC - Pedido #${order.id.slice(0, 8)} - Parcela ${installment.number}`,
          paymentMethod: isPix ? 'PIX' : 'LINK'
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao gerar cobrança InfinitePay');

      return data;
    } catch (err) {
      console.error('InfinitePayService Error:', err);
      throw err;
    }
  }
};
