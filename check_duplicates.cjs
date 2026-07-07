const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, total_value, customer_id, created_at, quote_number, contract_number')
    .neq('status', 'FINISHED')
    .neq('status', 'DELIVERED')
    .neq('status', 'IN_PRODUCTION')
    .neq('status', 'CONTRACT_SIGNED');
  
  if (error) console.error('Error fetching orders:', error);
  
  console.log(`Found ${orders?.length} unclosed orders (budgets).`);
  
  // Group by customer and total value to find potential duplicates
  const grouped = {};
  for (const o of (orders || [])) {
    const key = `${o.customer_id}_${o.total_value}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  }
  
  const duplicates = Object.values(grouped).filter(g => g.length > 1);
  console.log(`Found ${duplicates.length} groups of duplicates (same customer and same value).`);
  
  if (duplicates.length > 0) {
      console.log('Sample duplicate group:');
      console.log(duplicates[0]);
  }
  
  // also check quick_quotes
  const { data: quickQuotes, error: qqError } = await supabase
    .from('quick_quotes')
    .select('id, customer_id, total_value, created_at, quick_quote_number');
    
  if (qqError) console.error('Error fetching quick_quotes:', qqError);
  
  const groupedQq = {};
  for (const o of (quickQuotes || [])) {
    const key = `${o.customer_id}_${o.total_value}`;
    if (!groupedQq[key]) groupedQq[key] = [];
    groupedQq[key].push(o);
  }
  
  const qqDuplicates = Object.values(groupedQq).filter(g => g.length > 1);
  console.log(`Found ${qqDuplicates.length} groups of duplicate quick quotes.`);
  
  if (qqDuplicates.length > 0) {
      console.log('Sample duplicate qq group:');
      console.log(qqDuplicates[0].map(q => q.id));
  }
}
check();
