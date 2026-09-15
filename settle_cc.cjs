const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { 
  const [k, ...v] = line.split('='); 
  if(k) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '').replace('\r', ''); 
  return acc; 
}, {}); 

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('Iniciando baixa de parcelas Cartão de Crédito...');
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, installments, customer_id, seller_id, contract_number, quote_number')
    .eq('payment_method', 'Cartão de Crédito');
    
  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  console.log(`Encontrados ${orders.length} pedidos em Cartão de Crédito.`);

  const { data: categories } = await supabase.from('account_categories').select('*');
  const incomeCat = categories?.find(c => c.type === 'INCOME' && c.name.toUpperCase().includes('VENDA')) || categories?.find(c => c.type === 'INCOME') || categories?.[0];

  const { data: customers } = await supabase.from('customers').select('id, name');
  const customerMap = customers.reduce((acc, c) => ({...acc, [c.id]: c.name}), {});

  let updatedCount = 0;

  for (const order of orders) {
    if (!order.installments || order.installments.length === 0) continue;

    let hasChanges = false;
    const newTransactions = [];

    const updatedInstallments = order.installments.map(inst => {
      if (inst.status === 'PENDING') {
        hasChanges = true;
        
        const customerName = customerMap[order.customer_id] || '';
        const transaction = {
           id: crypto.randomUUID(),
           description: `Recebimento Parcela ${order.contract_number || order.quote_number || order.id.substring(0,8)} - ${customerName}`,
           amount: inst.value,
           type: 'INCOME',
           status: 'PAID',
           due_date: inst.dueDate,
           paid_date: inst.dueDate, // Usa a própria data de vencimento como data de pagamento
           order_id: order.id,
           installment_id: inst.id,
           payment_method: 'Cartão de Crédito',
           category_id: incomeCat ? incomeCat.id : null,
           notes: 'Baixa automática em lote'
        };
        newTransactions.push(transaction);

        return {
          ...inst,
          status: 'PAID',
          paymentDate: inst.dueDate,
          netValue: inst.value
        };
      }
      return inst;
    });

    if (hasChanges) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ installments: updatedInstallments })
        .eq('id', order.id);
        
      if (updateError) {
        console.error('Error updating order', order.id, updateError);
        continue;
      }
      
      for (const t of newTransactions) {
         await supabase.from('financial_transactions').insert(t);
      }
      
      updatedCount += newTransactions.length;
      console.log(`Pedido ${order.contract_number || order.id}: Baixadas ${newTransactions.length} parcelas.`);
    }
  }

  console.log(`\nFinalizado! Total de parcelas liquidadas: ${updatedCount}`);
}

run();
