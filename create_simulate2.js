import * as fs from 'fs';

const script = `
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\\n').reduce((acc, line) => { 
  const [k, v] = line.split('='); 
  if(k) acc[k.trim()] = v?.trim(); 
  return acc; 
}, {}); 

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY); 

async function insertFakeMessage() { 
  // Pega o último cliente
  const { data: outMsgs } = await supabase.from('whatsapp_messages').select('phone, client_id, instance_id').eq('direction', 'outbound').order('created_at', { ascending: false }).limit(1);
  
  if (outMsgs && outMsgs.length > 0) {
     const lastMsg = outMsgs[0];
     
     console.log("Inserindo resposta simulada para:", lastMsg.phone);
     
     const { data, error } = await supabase.from('whatsapp_messages').insert({
        id: require('crypto').randomUUID(),
        phone: lastMsg.phone,
        message: 'Aonde posso pagar? Quero fechar agora!',
        direction: 'inbound',
        status: 'received',
        client_id: lastMsg.client_id,
        instance_id: lastMsg.instance_id,
        created_at: new Date().toISOString()
     });
     
     if (error) console.error("Erro:", error);
     else console.log("Mensagem 2 inserida!");
  }
} 

insertFakeMessage();
`;

fs.writeFileSync('C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/simulate_webhook2.cjs', script, 'utf8');
console.log("Simulate 2 created.");
