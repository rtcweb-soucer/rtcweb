const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1] || '';
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateReport() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer_id,
      customer:customers(name),
      total_value,
      payment_method,
      payment_conditions,
      installments,
      created_at
    `)
    .gte('created_at', '2026-08-01T00:00:00.000Z')
    .lte('created_at', '2026-09-30T23:59:59.999Z');

  if (error) {
    console.error("Erro:", error);
    return;
  }
  
  let count = 0;
  let totalFuturePix = 0;
  const reportData = [];

  for (const order of orders) {
    // Check if there are installments
    const installments = order.installments || [];
    if (installments.length >= 2) {
      // Find the first and second
      const first = installments.find(i => i.number === 1);
      const second = installments.find(i => i.number === 2);
      
      const paymentMethodLower = (order.payment_method || '').toLowerCase();
      const conditionsLower = (order.payment_conditions || '').toLowerCase();
      
      // The user says "segundas parcelas em pix futuros". So we look for Pix and second installment pending
      if (
          (paymentMethodLower.includes('pix') || conditionsLower.includes('pix') || (second && second.paymentMethod && second.paymentMethod.toLowerCase().includes('pix'))) &&
          first && first.status === 'PAID' &&
          second && second.status === 'PENDING'
      ) {
         count++;
         totalFuturePix += second.value || 0;
         reportData.push({
            date: order.created_at.split('T')[0],
            customer: order.customer ? order.customer.name : 'Desconhecido',
            orderTotal: order.total_value,
            secondInstallmentValue: second.value,
            paymentMethod: order.payment_method,
            conditions: order.payment_conditions
         });
      }
    }
  }

  console.log(`\n=== RELATÓRIO: SEGUNDAS PARCELAS EM PIX (AGO e SET/2026) ===\n`);
  console.log(`Total de Pedidos encontrados: ${count}`);
  console.log(`Valor Total a receber em segundas parcelas (Pix Futuro): R$ ${totalFuturePix.toFixed(2)}\n`);
  
  console.table(reportData);
}

generateReport();
