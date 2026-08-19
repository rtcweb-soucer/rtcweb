const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { 
  const [k, ...v] = line.split('='); 
  if(k) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '').replace('\r', ''); 
  return acc; 
}, {}); 
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY); 

async function run() {
  console.log('Fetching most recent orders...');
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, customer:customers(name, id)')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
      console.log('Error:', error);
  } else {
      const ledaOrders = orders.filter(o => o.customer?.name?.toLowerCase().includes('leda'));
      if (ledaOrders.length > 0) {
          console.log('Found Leda in orders:', JSON.stringify(ledaOrders, null, 2));
      } else {
          console.log('No Leda found in recent orders. Here are the last 3 orders to see the structure:');
          console.log(JSON.stringify(orders.slice(0, 3), null, 2));
      }
  }
}

run();
