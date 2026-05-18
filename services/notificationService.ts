import { Order, Installment } from '../types';
import { dataService } from './dataService';
import { infinitePayService } from './infinitePayService';
import { evolutionService } from './evolutionService';

export const notificationService = {
  /**
   * Envia as cobranças iniciais do contrato:
   * 1. Parcela 1 (Geralmente PIX)
   * 2. Todas as demais parcelas de Cartão agrupadas em um único link.
   */
  async sendContractInitialCharges(order: Order) {
    // Agora o envio inicial (Entrada e Cartão) é manual no Financeiro.
    // Esta função permanece vazia ou apenas para log, conforme pedido.
    console.log(`ℹ️ O envio inicial para o Pedido ${order.contractNumber || order.id} agora deve ser acionado manualmente.`);
  },

  /**
   * Envia automaticamente a cobrança via WhatsApp para uma parcela específica.
   * Chamado principalmente após a instalação (parcela 2).
   */
  async sendAutomatedPaymentNotification(order: Order, installmentNumber: number) {
    if (!order.installments || !order.customerPhone) return;

    const installment = order.installments.find(i => i.number === installmentNumber);
    if (!installment || installment.status === 'PAID') return;

    try {
      console.log(`🚀 Gerando cobrança automática para Parcela ${installmentNumber} do Pedido ${order.id}...`);
      
      const customerData = {
        name: order.customerName || 'Cliente',
        email: '', // Email opcional se disponível
        phone: order.customerPhone.startsWith('+') ? order.customerPhone : `+55${order.customerPhone.replace(/\D/g, '')}`
      };

      const charge = await infinitePayService.createCharge(order, installment, customerData);
      
      // Atualizar o pedido com o link/código gerado
      const updatedInstallments = order.installments.map(i => {
        if (i.number === installmentNumber) {
          return {
            ...i,
            paymentLink: charge.url,
            pixCopyPaste: charge.pixCode,
            paymentId: charge.id // Slug para consulta
          };
        }
        return i;
      });

      await dataService.saveOrder({ ...order, installments: updatedInstallments });

      let message = `Olá! Referente ao seu pedido *${order.contractNumber || order.id.slice(0, 8)}*, segue a cobrança da parcela *${installmentNumber}/${order.installments.length}*.\n\n`;
      message += `💰 *Valor:* R$ ${installment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      
      if (charge.pixCode) {
        message += `\n*Código PIX Copia e Cola:*\n\`${charge.pixCode}\`\n\n_Copie e cole no app do seu banco._`;
      } else {
        message += `\n🔗 *Link para Pagamento:* ${charge.url}`;
      }

      await evolutionService.sendMessageAuto(order.customerPhone, message);
      console.log(`✅ Cobrança automática enviada via WhatsApp.`);

    } catch (err) {
      console.error(`❌ Erro na cobrança automática:`, err);
    }
  },

  async notifyFinanceAboutInstallation(order: Order) {
    // Lógica legado mantida para segurança
    return null;
  }
};
