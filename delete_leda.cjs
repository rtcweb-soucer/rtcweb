const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { 
  const [k, ...v] = line.split('='); 
  if(k) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '').replace('\r', ''); 
  return acc; 
}, {}); 
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY); 

async function run() {
  console.log('Deleting duplicate PROP-2660...');
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', 'PROP-2660');
    
  if (error) {
    console.error('Error deleting:', error);
  } else {
    console.log('Delete success');
  }
}

run();
