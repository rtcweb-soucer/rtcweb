import { Order, Installment } from '../types';
import { dataService } from './dataService';
import { infinitePayService } from './infinitePayService';
import { evolutionService } from './evolutionService';

export const notificationService = {
  /**
   * Envia automaticamente a cobrança via WhatsApp para uma parcela específica.
   */
  async sendAutomatedPaymentNotification(order: Order, installmentNumber: number) {
    if (!order.installments) return;

    const installment = order.installments.find(i => i.number === installmentNumber);
    if (!installment || installment.status === 'PAID') return;

    const method = (installment.paymentMethod || order.paymentMethod || '').toUpperCase();
    const isPix = method.includes('PIX');
    const isCreditCard = method.includes('CARTÃO') || method.includes('CARTAO') || method.includes('CREDITO') || method.includes('CRÉDITO');

    if (!isPix && !isCreditCard) {
      console.log(`⚠️ Método de pagamento "${method}" não suporta automação InfinitePay.`);
      return;
    }

    try {
      console.log(`🚀 Iniciando automação de cobrança para Pedido #${order.id.slice(0, 8)}, Parcela ${installmentNumber}...`);
      
      // 1. Gerar cobrança na InfinitePay
      const charge = await infinitePayService.createCharge(order, installment);
      
      // 2. Atualizar a parcela com o link/código gerado
      const updatedInstallments = order.installments.map(i => {
        if (i.number === installmentNumber) {
          return {
            ...i,
            paymentLink: charge.type === 'LINK' ? charge.url : i.paymentLink,
            pixCopyPaste: charge.type === 'PIX' ? charge.pixCode : i.pixCopyPaste
          };
        }
        return i;
      });

      const updatedOrder = { ...order, installments: updatedInstallments };
      await dataService.saveOrder(updatedOrder);

      // 3. Formatar mensagem
      let message = `Olá, tudo bem? Aqui é da *RTC Toldos & Cortinas*! 🏠\n\n`;
      message += `Referente ao seu pedido *${order.contractNumber || order.id.slice(0, 8)}*, estamos enviando a cobrança da parcela *${installmentNumber}/${order.installments.length}*.\n\n`;
      message += `💰 *Valor:* R$ ${installment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      
      if (charge.type === 'PIX') {
        message += `🔑 *Método:* PIX (Copia e Cola)\n\n`;
        message += `Abaixo segue o código para pagamento:\n\n`;
        message += `\`${charge.pixCode}\`\n\n`;
        message += `_Basta copiar o código acima e colar no aplicativo do seu banco._`;
      } else {
        message += `💳 *Método:* Cartão de Crédito\n\n`;
        message += `Acesse o link seguro para realizar o pagamento:\n`;
        message += `${charge.url}\n\n`;
        message += `_Você pode parcelar conforme as condições da InfinitePay._`;
      }

      message += `\n\nQualquer dúvida, estamos à disposição! ✅`;

      // 4. Enviar mensagem via WhatsApp (Telefone do Cliente)
      if (order.customerPhone) {
        await evolutionService.sendMessage(order.customerPhone, message);
        console.log(`✅ Notificação enviada com sucesso para ${order.customerPhone}`);
      } else {
        console.warn(`⚠️ Cliente sem telefone cadastrado para o pedido ${order.id}`);
      }

    } catch (err) {
      console.error(`❌ Falha na automação de cobrança:`, err);
      // Aqui poderíamos emitir um alerta interno para o financeiro
    }
  },

  /**
   * Notificação simplificada para o financeiro interno (legado/suporte)
   */
  async notifyFinanceAboutInstallation(order: Order) {
    if (!order.installments || order.installments.length === 0) return null;

    const pendingInstallments = order.installments.filter(
      (inst: Installment) => 
        inst.status === 'PENDING' && 
        order.paymentMethod?.toLowerCase() !== 'cartão de crédito' &&
        order.paymentMethod?.toLowerCase() !== 'cartao de credito' &&
        inst.paymentMethod?.toLowerCase() !== 'cartão de crédito'
    );

    if (pendingInstallments.length > 0) {
      return {
        type: 'FINANCIAL_PENDENCY',
        message: `Instalação concluída para ${order.contractNumber || order.id}. Existem parcelas pendentes para cobrança (Método: ${order.paymentMethod}).`,
        orderId: order.id,
        count: pendingInstallments.length
      };
    }
    return null;
  }
};
