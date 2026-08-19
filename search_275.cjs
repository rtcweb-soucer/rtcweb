const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { 
  const [k, ...v] = line.split('='); 
  if(k) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '').replace('\r', ''); 
  return acc; 
}, {}); 
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY); 

async function run() {
  console.log('Searching for 275...');
  const { data: order275, error: e1 } = await supabase
    .from('orders')
    .select('*')
    .ilike('contract_number', '%275%');
    
  console.log('Order 275:', order275);
  
  console.log('Searching for Leda in production_tracking...');
  const { data: tracking, error: e2 } = await supabase
    .from('production_tracking')
    .select('*')
    .in('order_id', ['PROP-9536', 'PROP-2660']);
    
  console.log('Tracking for Leda:', tracking);
}

run();
