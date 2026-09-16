import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase (Server-side)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ASAAS_WEBHOOK_TOKEN = 'whsec__gdnmTqIB9ORj2TIDBRMnahQh2YuAiCWBI_sdXW9tz8';
  const providedToken = req.headers['asaas-access-token'];

  if (providedToken !== ASAAS_WEBHOOK_TOKEN) {
    console.error('❌ Token de Webhook Inválido ou Ausente');
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  try {
    const payload = req.body;
    
    // Grava de forma segura no banco de dados para auditoria
    await supabase.from('webhook_payloads').insert({ payload });
    
    console.log('📦 Webhook Asaas recebido (Payload completo):', JSON.stringify(payload));

    const { event, payment } = payload;

    // Queremos ouvir apenas eventos de pagamento recebido/confirmado
    if (event !== 'PAYMENT_RECEIVED' && event !== 'PAYMENT_CONFIRMED') {
      return res.status(200).json({ message: 'Evento ignorado', event });
    }

    if (!payment || !payment.externalReference) {
      return res.status(400).json({ error: 'Referência externa ausente no pagamento' });
    }

    const order_nsu = payment.externalReference;
    const parts = order_nsu.split('_');
    const orderId = parts[0];
    const installmentId = parts[1];

    // 1. Buscar o pedido no Supabase
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      console.error('❌ Pedido não encontrado no Webhook:', orderId);
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    // 2. Localizar as parcelas alvos
    let targetInstallments = [];
    const isMasterPayment = !installmentId || installmentId === 'master';

    (order.installments || []).forEach(inst => {
      if (inst.status !== 'PAID' && (isMasterPayment || inst.id === installmentId)) {
        targetInstallments.push(inst);
      }
    });

    if (targetInstallments.length === 0) {
      return res.status(200).json({ message: 'Parcela(s) já estavam pagas ou não alocadas.', ignoradas: true });
    }

    const sumInstallments = targetInstallments.reduce((acc, curr) => acc + curr.value, 0);
    const grossTotal = payment.value || sumInstallments;
    const netTotal = payment.netValue || grossTotal;

    // 3. Atualizar o Array do banco de dados proporcionalmente
    const updatedInstallments = (order.installments || []).map(inst => {
      const isTarget = targetInstallments.find(t => t.id === inst.id);
      if (isTarget) {
         const proportion = inst.value / sumInstallments;
         const instNetValue = netTotal * proportion;
         
         return {
           ...inst,
           status: 'PAID',
           paymentDate: payment.paymentDate || new Date().toISOString(),
           netValue: instNetValue,
           paymentMethod: payment.billingType || inst.paymentMethod
         };
      }
      return inst;
    });

    const { error: updateError } = await supabase
      .from('orders')
      .update({ installments: updatedInstallments })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // 4. Registrar a Transação Financeira (Individualizada por Parcela Proporcional)
    const { data: incomeCats } = await supabase.from('account_categories').select('id').ilike('name', '%venda%').eq('type', 'INCOME').limit(1);
    const categoryIncomeId = incomeCats?.[0]?.id || null;

    const transactionsToInsert = targetInstallments.map(inst => {
      const proportion = inst.value / sumInstallments;
      const instNetValue = netTotal * proportion;
      const feeAmount = (grossTotal * proportion) - instNetValue;

      return {
        order_id: orderId,
        installment_id: inst.id,
        amount: instNetValue, // Lança o valor líquido
        type: 'INCOME',
        status: 'PAID',
        due_date: new Date().toISOString(),
        paid_date: new Date().toISOString(),
        description: `Recebimento Pedido ${order.contractNumber || order.id.slice(0, 8)} - Parc ${inst.number} (Asaas)`,
        payment_method: payment.billingType || inst.paymentMethod || 'PIX',
        category_id: categoryIncomeId
      };
    });

    const { error: transError } = await supabase.from('financial_transactions').insert(transactionsToInsert);
    if (transError) console.error('⚠️ Erro ao registrar transações individuais no Webhook:', transError);

    return res.status(200).json({ message: 'Webhook processado com sucesso', atualizadas: targetInstallments.length });

  } catch (error) {
    console.error('🔥 Erro no processamento do Webhook Asaas:', error);
    return res.status(500).json({ error: 'Erro interno no processamento' });
  }
}
