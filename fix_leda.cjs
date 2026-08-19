const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { 
  const [k, ...v] = line.split('='); 
  if(k) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '').replace('\r', ''); 
  return acc; 
}, {}); 
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY); 

async function run() {
  console.log('Updating PROP-9536 to Contrato 2026-275...');
  const { data, error } = await supabase
    .from('orders')
    .update({
      contract_number: 'Contrato 2026-275',
      quote_number: 'ORC 2026-240',
      status: 'APPROVED',
      production_stage: 'PREPARATION'
    })
    .eq('id', 'PROP-9536')
    .select();
    
  if (error) {
    console.error('Error updating:', error);
  } else {
    console.log('Update success:', data);
  }
}

run();
