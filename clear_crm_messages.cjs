const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function clear() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .delete()
    .lt('created_at', today.toISOString())
    .select();
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Deleted ${data ? data.length : 0} old whatsapp_messages before ${today.toISOString()}`);
}

clear();
