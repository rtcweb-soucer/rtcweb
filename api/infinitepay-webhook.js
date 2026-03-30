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

    // 2. Localizar e atualizar a parcela (ou TODAS as parcelas pendentes se for Master)
    let updated = false;
    let targetInstallments = [];
    const isMasterPayment = !installmentId;

    const updatedInstallments = (order.installments || []).map(inst => {
      // Condição: Está pendente E (é o Pagamento Mestre Múltiplo OU é a Parcela Específica)
      if (inst.status !== 'PAID' && (isMasterPayment || inst.id === installmentId)) {
        updated = true;
        targetInstallments.push(inst);
        return {
          ...inst,
          status: 'PAID',
          paymentDate: new Date().toISOString(),
          netValue: payload.net_value || net_value || inst.value,
          paymentMethod: capture_method ? capture_method.toUpperCase() : (payment_method || inst.paymentMethod),
          paymentLink: payload.receipt_url || inst.paymentLink // Guarda o recibo oficial por segurança
        };
      }
      return inst;
    });

    if (!updated) {
      return res.status(200).json({ message: 'Parcela(s) já estavam pagas ou não alocadas.', ignoradas: true });
    }

    // 3. Salvar o pedido com a(s) parcela(s) baixada(s)
    const { error: updateError } = await supabase
      .from('orders')
      .update({ installments: updatedInstallments })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // 4. Registrar a Transação Financeira Principal para o Fluxo de Caixa
    const { data: categories } = await supabase
      .from('account_categories')
      .select('id')
      .ilike('name', '%venda%')
      .eq('type', 'INCOME')
      .limit(1);

    const categoryId = categories?.[0]?.id || null;
    const finalAmount = payload.paid_amount || value || amount || net_value || targetInstallments.reduce((acc, curr) => acc + curr.value, 0);

    const { error: transError } = await supabase
      .from('financial_transactions')
      .insert({
        description: `REC: Pedido ${order.contractNumber || order.id.slice(0,8)} ${isMasterPayment ? '(Múltiplas - AUTO)' : `(Parc ${targetInstallments[0].number} - AUTO)`}`,
        amount: finalAmount,
        type: 'INCOME',
        status: 'PAID',
        due_date: new Date().toISOString().split('T')[0],
        paid_date: new Date().toISOString(),
        order_id: orderId,
        installment_id: !isMasterPayment ? installmentId : null,
        category_id: categoryId,
        payment_method: (capture_method || payment_method || 'InfinitePay').toUpperCase()
      });

    if (transError) console.error('⚠️ Erro ao registrar transação financeira no Webhook (Master):', transError);

    console.log(`✅ Pagamento detectado! ${targetInstallments.length} parcelas do pedido ${orderId} liquidadas!`);
    return res.status(200).json({ success: true, processed_installments: targetInstallments.length });

  } catch (error) {
    console.error('🔥 Erro no processamento do Webhook InfinitePay:', error);
    return res.status(500).json({ error: error.message });
  }
}
