const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteDuplicates() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, total_value, customer_id, created_at, quote_number, contract_number')
    .neq('status', 'FINISHED')
    .neq('status', 'DELIVERED')
    .neq('status', 'IN_PRODUCTION')
    .neq('status', 'CONTRACT_SIGNED');
  
  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }
  
  const grouped = {};
  for (const o of (orders || [])) {
    const key = `${o.customer_id}_${o.total_value}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  }
  
  const duplicates = Object.values(grouped).filter(g => g.length > 1);
  let deletedCount = 0;
  
  for (const group of duplicates) {
    // Sort by created_at ascending (keep the oldest one)
    group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const toKeep = group[0];
    const toDelete = group.slice(1);
    
    for (const item of toDelete) {
      console.log(`Deleting duplicate order: ${item.id} (keeping ${toKeep.id})`);
      const { error: delError } = await supabase
        .from('orders')
        .delete()
        .eq('id', item.id);
        
      if (delError) {
        console.error(`Failed to delete ${item.id}:`, delError);
      } else {
        deletedCount++;
      }
    }
  }
  
  console.log(`Deleted ${deletedCount} duplicate unclosed orders.`);
  
  // Now for quick quotes
  const { data: quickQuotes, error: qqError } = await supabase
    .from('quick_quotes')
    .select('id, customer_id, total_value, created_at, quick_quote_number');
    
  if (qqError) {
    console.error('Error fetching quick_quotes:', qqError);
    return;
  }
  
  const groupedQq = {};
  for (const o of (quickQuotes || [])) {
    const key = `${o.customer_id}_${o.total_value}`;
    if (!groupedQq[key]) groupedQq[key] = [];
    groupedQq[key].push(o);
  }
  
  const qqDuplicates = Object.values(groupedQq).filter(g => g.length > 1);
  let qqDeletedCount = 0;
  
  for (const group of qqDuplicates) {
    group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const toKeep = group[0];
    const toDelete = group.slice(1);
    
    for (const item of toDelete) {
      console.log(`Deleting duplicate quick_quote: ${item.id} (keeping ${toKeep.id})`);
      const { error: delError } = await supabase
        .from('quick_quotes')
        .delete()
        .eq('id', item.id);
        
      if (delError) {
        console.error(`Failed to delete ${item.id}:`, delError);
      } else {
        qqDeletedCount++;
      }
    }
  }
  
  console.log(`Deleted ${qqDeletedCount} duplicate quick quotes.`);
}

deleteDuplicates();
