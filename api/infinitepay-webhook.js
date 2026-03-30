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

    // A API V1 de checkout pode retornar "status": "paid"
    const isApproved = paid === true || status === 'APPROVED' || status === 'paid';

    if (!isApproved) {
      return res.status(200).json({ message: 'Pagamento ainda não aprovado ou status pendente', recebido: status });
    }

    if (!order_nsu || !order_nsu.includes('_')) {
      return res.status(400).json({ error: 'NSU inválido' });
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

    // 2. Localizar e atualizar a parcela
    let updated = false;
    const updatedInstallments = order.installments.map(inst => {
      if (inst.id === installmentId && inst.status !== 'PAID') {
        updated = true;
        return {
          ...inst,
          status: 'PAID',
          paymentDate: new Date().toISOString(),
          netValue: net_value || inst.value,
          paymentMethod: capture_method ? capture_method.toUpperCase() : (payment_method || inst.paymentMethod)
        };
      }
      return inst;
    });

    if (!updated) {
      return res.status(200).json({ message: 'Parcela já estava paga ou não encontrada' });
    }

    // 3. Salvar o pedido atualizado
    const { error: updateError } = await supabase
      .from('orders')
      .update({ installments: updatedInstallments })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // 4. Registrar transação no financeiro (transaction table)
    // Buscamos a categoria de receita padrão
    const { data: categories } = await supabase
      .from('account_categories')
      .select('id')
      .ilike('name', '%venda%')
      .eq('type', 'INCOME')
      .limit(1);

    const categoryId = categories?.[0]?.id;

    const { error: transError } = await supabase
      .from('financial_transactions')
      .insert({
        description: `REC: Pedido ${order.contractNumber || order.id.slice(0,8)} (Parcela via Webhook)`,
        amount: value || 0,
        type: 'INCOME',
        status: 'PAID',
        due_date: new Date().toISOString().split('T')[0],
        paid_date: new Date().toISOString(),
        order_id: orderId,
        installment_id: installmentId,
        category_id: categoryId,
        payment_method: (payment_method || 'InfinitePay').toUpperCase()
      });

    if (transError) console.error('⚠️ Erro ao registrar transação financeira no Webhook:', transError);

    console.log(`✅ Parcela ${installmentId} do pedido ${orderId} liquidada via Webhook.`);
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('🔥 Erro no processamento do Webhook InfinitePay:', error);
    return res.status(500).json({ error: error.message });
  }
}
