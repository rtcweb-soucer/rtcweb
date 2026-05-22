const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { 
  const [k, ...v] = line.split('='); 
  if(k) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '').replace('\r', ''); 
  return acc; 
}, {}); 
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY); 
supabase.from('crm_leads').update({ phone: '5521999545686', customer_id: '6e87775c-3568-4ba1-a9ff-11358fff57cb' }).eq('id', '68e8ba2f-e0f9-452d-8ad1-cec288eff526').then(res => console.log('Updated lead!', res.error));
