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
    if (!order.installments || order.installments.length === 0) return;

    try {
      console.log(`🚀 Gerando cobranças iniciais para o Pedido ${order.contractNumber || order.id}...`);
      
      const installments = [...order.installments];
      const firstInstallment = installments[0];
      const cardInstallments = installments.slice(1).filter(i => 
        (i.paymentMethod || '').toUpperCase().includes('CART') || 
        (i.paymentMethod || '').toUpperCase().includes('CREDIT')
      );

      // 1. Processar Parcela 1 se for PIX
      if (firstInstallment.status === 'PENDING' && (firstInstallment.paymentMethod || '').toUpperCase().includes('PIX')) {
        const pixCharge = await infinitePayService.createCharge(order, firstInstallment);
        firstInstallment.pixCopyPaste = pixCharge.pixCode;
        firstInstallment.paymentId = pixCharge.id;

        const message = `Olá! Segue o código PIX para a *Entrada* do seu pedido *${order.contractNumber || order.id.slice(0, 8)}*:\n\n` +
                        `💰 *Valor:* R$ ${firstInstallment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
                        `\`${pixCharge.pixCode}\`\n\n` +
                        `_Copie e cole no app do seu banco._`;
        
        if (order.customerPhone) await evolutionService.sendMessage(order.customerPhone, message);
      }

      // 2. Processar Saldo no Cartão (Agrupado)
      if (cardInstallments.length > 0) {
        const totalValue = cardInstallments.reduce((sum, i) => sum + i.value, 0);
        const firstCardInst = cardInstallments[0];
        
        // Criamos uma "parcela virtual" para gerar o link do saldo total
        const virtualInstallment: Installment = {
          ...firstCardInst,
          value: totalValue,
          paymentMethod: 'Cartão de Crédito'
        };

        const linkCharge = await infinitePayService.createCharge(order, virtualInstallment, order.cardInstallments);
        
        // Atribuir o mesmo link e ID para todas as parcelas do cartão
        cardInstallments.forEach(i => {
          i.paymentLink = linkCharge.url;
          i.paymentId = linkCharge.id;
        });

        const message = `Olá! Aqui está o link para o pagamento do *Saldo* do seu pedido em até *${order.cardInstallments || 12}x* no cartão:\n\n` +
                        `💰 *Valor Total:* R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
                        `🔗 *Link:* ${linkCharge.url}\n\n` +
                        `_Você pode parcelar diretamente no link acima._`;

        if (order.customerPhone) await evolutionService.sendMessage(order.customerPhone, message);
      }

      // 3. Salvar alterações no pedido
      await dataService.saveOrder({ ...order, installments });
      console.log(`✅ Cobranças iniciais enviadas e salvas.`);

    } catch (err) {
      console.error(`❌ Erro nas cobranças iniciais:`, err);
    }
  },

  /**
   * Envia automaticamente a cobrança via WhatsApp para uma parcela específica.
   * (Mantida para cobranças avulsas/posteriores)
   */
  async sendAutomatedPaymentNotification(order: Order, installmentNumber: number) {
    if (!order.installments) return;

    const installment = order.installments.find(i => i.number === installmentNumber);
    if (!installment || installment.status === 'PAID') return;

    try {
      const charge = await infinitePayService.createCharge(order, installment);
      
      const updatedInstallments = order.installments.map(i => {
        if (i.number === installmentNumber) {
          return {
            ...i,
            paymentLink: charge.type === 'LINK' ? charge.url : i.paymentLink,
            pixCopyPaste: charge.type === 'PIX' ? charge.pixCode : i.pixCopyPaste,
            paymentId: charge.id
          };
        }
        return i;
      });

      await dataService.saveOrder({ ...order, installments: updatedInstallments });

      let message = `Olá! Referente ao seu pedido *${order.contractNumber || order.id.slice(0, 8)}*, segue a cobrança da parcela *${installmentNumber}/${order.installments.length}*.\n\n`;
      message += `💰 *Valor:* R$ ${installment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      
      if (charge.type === 'PIX') {
        message += `\`${charge.pixCode}\``;
      } else {
        message += `🔗 *Link:* ${charge.url}`;
      }

      if (order.customerPhone) await evolutionService.sendMessage(order.customerPhone, message);

    } catch (err) {
      console.error(`❌ Erro na cobrança avulsa:`, err);
    }
  },

  async notifyFinanceAboutInstallation(order: Order) {
    // Lógica legado mantida para segurança
    return null;
  }
};
