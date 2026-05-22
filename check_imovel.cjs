const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { 
  const [k, ...v] = line.split('='); 
  if(k) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '').replace('\r', ''); 
  return acc; 
}, {}); 
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY); 
supabase.from('crm_leads').select('*, customer:customers(*)').ilike('notes', '%imóvel%').then(res => console.log(JSON.stringify(res.data, null, 2)));
