import { Order, Installment } from '../types';

export const infinitePayService = {
  /**
   * Generates a payment link for an order or specific installment
   */
  async createPaymentLink(order: Order, amount: number, description: string) {
    try {
      const response = await fetch('/api/infinitepay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          capture_method: 'EXTERNAL',
          description: description,
          metadata: {
            order_id: order.id,
            quote_number: order.quoteNumber || '',
            contract_number: order.contractNumber || ''
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment link');
      }

      return await response.json();
    } catch (err) {
      console.error('Error creating InfinitePay link:', err);
      throw err;
    }
  },

  /**
   * Checks the status of a specific payment link
   */
  async getLinkStatus(linkId: string) {
    try {
      const response = await fetch(`/api/infinitepay?linkId=${linkId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch payment status');
      }
      return await response.json();
    } catch (err) {
      console.error('Error checking InfinitePay status:', err);
      throw err;
    }
  },

  /**
   * Syncs an order's installments based on InfinitePay status
   * This is a "manual" sync that can be triggered from the UI
   */
  async syncOrderStatus(order: Order, onUpdateOrder: (order: Order) => void) {
    if (!order.paymentLink || !order.installments) return;

    try {
      const statusData = await this.getLinkStatus(order.paymentLink);
      
      // If payment is successful, mark as PAID
      if (statusData.status === 'PAID' || statusData.status === 'SUCCESS') {
        const updatedInstallments = order.installments.map(inst => ({
          ...inst,
          status: 'PAID' as const,
          paymentDate: inst.paymentDate || new Date().toISOString()
        }));

        const updatedOrder: Order = {
          ...order,
          installments: updatedInstallments
        };

        // Here we would typically call dataService.saveOrder(updatedOrder)
        // But we return it to the UI callback for consistency
        onUpdateOrder(updatedOrder);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Sync failed:', err);
      return false;
    }
  }
};
