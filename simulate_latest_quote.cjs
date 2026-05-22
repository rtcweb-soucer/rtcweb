const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '').replace('\r', '');
});

const supabaseUrl = env['VITE_SUPABASE_URL'] || '';
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulate() {
  // 1. Get the latest order
  const { data: orders, error: qErr } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (qErr || !orders || orders.length === 0) {
    console.error('No orders found', qErr);
    return;
  }

  const latestQuote = orders[0];
  console.log('Latest quote found:', latestQuote.id, 'for customer', latestQuote.customer_id);

  // 2. Get customer phone
  const { data: customers, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', latestQuote.customer_id)
    .single();

  if (cErr || !customers) {
    console.error('Customer not found', cErr);
    return;
  }

  const rawPhone = customers.phone || customers.phone2;
  if (!rawPhone) {
     console.error('Customer has no phone number');
     return;
  }

  const cleanPhone = rawPhone.replace(/\D/g, '');
  const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

  console.log('Simulating message for phone:', finalPhone);

  // 3. Insert message
  const { error: insErr } = await supabase
    .from('whatsapp_messages')
    .insert([{
      phone: finalPhone,
      message: 'Olá, estive pensando e quero fechar o orçamento agora mesmo!',
      direction: 'inbound',
      status: 'received'
    }]);

  if (insErr) {
    console.error('Failed to insert message', insErr);
  } else {
    console.log('Simulated message inserted successfully!');
  }
}

simulate();
