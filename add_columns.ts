import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { 
  const [k, ...v] = line.split('='); 
  if(k) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '').replace('\r', ''); 
  return acc; 
}, {}); 

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY); 

async function run() {
  // Add push_name and unread_count to crm_leads
  console.log("Adding columns to crm_leads...");
  let { error } = await supabase.rpc('execute_sql', { sql: `
    ALTER TABLE public.crm_leads 
    ADD COLUMN IF NOT EXISTS push_name TEXT,
    ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
  `});
  if (error) console.error("RPC error (maybe execute_sql doesn't exist?):", error);
  
  // Alternative if RPC doesn't work: just use Supabase direct or assume user can run it.
  // We don't have execute_sql by default in Supabase. We can try to use a dummy insert or just prompt the user.
}
run();
