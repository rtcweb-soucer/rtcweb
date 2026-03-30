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

  try {
    const payload = req.body;
    
    // Grava de forma segura no banco de dados para a gente bisbilhotar do que é feito
    await supabase.from('webhook_payloads').insert({ payload });
    
    const { order_nsu, paid, status, value, net_value, payment_method, amount, capture_method } = payload;

    console.log('📦 Webhook InfinitePay recebido (Payload completo):', JSON.stringify(payload));

    // A API V1 de checkout não envia campo "status". Ela envia "transaction_nsu" e "paid_amount"
    const isApproved = paid === true || 
                       status === 'APPROVED' || 
                       status === 'paid' || 
                       (payload.transaction_nsu && payload.paid_amount > 0);

    if (!isApproved) {
      return res.status(200).json({ message: 'Pagamento não validado como aprovado', payload_recebido: payload });
    }

    if (!order_nsu) {
      return res.status(400).json({ error: 'NSU inválido ou não referenciado' });
    }

    const [orderId, installmentId] = order_nsu.split('_');

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
    const isMasterPayment = !installmentId;

    (order.installments || []).forEach(inst => {
      if (inst.status !== 'PAID' && (isMasterPayment || inst.id === installmentId)) {
        targetInstallments.push(inst);
      }
    });

    if (targetInstallments.length === 0) {
      return res.status(200).json({ message: 'Parcela(s) já estavam pagas ou não alocadas.', ignoradas: true });
    }

    const sumInstallments = targetInstallments.reduce((acc, curr) => acc + curr.value, 0);
    const grossTotal = payload.paid_amount || value || amount || sumInstallments;
    const netTotal = payload.net_value || payload.net_amount || net_value || grossTotal;

    // 3. Atualizar o Array do banco de dados proporcionalmente
    const updatedInstallments = (order.installments || []).map(inst => {
      const isTarget = targetInstallments.find(t => t.id === inst.id);
      if (isTarget) {
         const proportion = inst.value / sumInstallments;
         const instNetValue = netTotal * proportion;
         
         return {
           ...inst,
           status: 'PAID',
           paymentDate: new Date().toISOString(),
           netValue: instNetValue,
           paymentMethod: capture_method ? capture_method.toUpperCase() : (payment_method || inst.paymentMethod),
           paymentLink: payload.receipt_url || inst.paymentLink
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

    const { data: expenseCats } = await supabase.from('account_categories').select('id').eq('code', '2.0.0').limit(1);
    let categoryExpenseId = expenseCats?.[0]?.id;
    if (!categoryExpenseId) {
        const { data: fallbackExp } = await supabase.from('account_categories').select('id').eq('type', 'EXPENSE').limit(1);
        categoryExpenseId = fallbackExp?.[0]?.id || null;
    }

    const transactionsToInsert = [];

    targetInstallments.forEach(inst => {
        const proportion = inst.value / sumInstallments;
        const mappedGross = grossTotal * proportion;
        const mappedNet = netTotal * proportion;
        const difference = mappedGross - mappedNet;
        const methodFinal = (capture_method || payment_method || inst.paymentMethod || 'InfinitePay').toUpperCase();

        // Receita
        transactionsToInsert.push({
            description: `REC: Pedido ${order.contractNumber || order.id.slice(0,8)} (Parc ${inst.number} - AUTO)`,
            amount: mappedNet,
            type: 'INCOME',
            status: 'PAID',
            due_date: new Date(inst.dueDate).toISOString().split('T')[0],
            paid_date: new Date().toISOString(),
            order_id: orderId,
            installment_id: inst.id,
            category_id: categoryIncomeId,
            payment_method: methodFinal
        });

        // Despesa (Taxa)
        if (difference > 0.01) {
            transactionsToInsert.push({
                description: `Taxa Cartão: Pedido ${order.contractNumber || order.id.slice(0,8)} (Parc ${inst.number})`,
                amount: difference,
                type: 'EXPENSE',
                status: 'PAID',
                due_date: new Date().toISOString().split('T')[0],
                paid_date: new Date().toISOString(),
                order_id: orderId,
                installment_id: inst.id,
                category_id: categoryExpenseId,
                notes: 'Taxa descontada automaticamente pela InfinitePay',
                payment_method: methodFinal
            });
        }
    });

    const { error: transError } = await supabase.from('financial_transactions').insert(transactionsToInsert);

    if (transError) console.error('⚠️ Erro ao registrar transações individuais no Webhook:', transError);

    console.log(`✅ Pagamento processado! ${targetInstallments.length} parcelas do pedido ${orderId} liquidadas com suas respectivas taxas!`);
    return res.status(200).json({ success: true, processed_installments: targetInstallments.length });

  } catch (error) {
    console.error('🔥 Erro no processamento do Webhook InfinitePay:', error);
    return res.status(500).json({ error: error.message });
  }
}
