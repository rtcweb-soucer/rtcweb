const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1] || '';
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testOnePending() {
  console.log("Buscando a primeira mensagem PENDING da fila...");
  const { data: pendingMsgs, error: msgError } = await supabase
    .from('mass_messages')
    .select('*')
    .eq('status', 'PENDING')
    .limit(1);

  if (msgError || !pendingMsgs || pendingMsgs.length === 0) {
    console.log("Erro ao buscar fila ou fila vazia:", msgError);
    return;
  }

  const msg = pendingMsgs[0];
  console.log(`Mensagem encontrada: ID ${msg.id} | Telefone: ${msg.phone} | Nome: ${msg.name}`);

  console.log("Buscando configurações da YCloud...");
  const { data: ycSettings, error: ycError } = await supabase.from('api_settings').select('*').eq('service', 'ycloud').maybeSingle();
  
  if (ycError || !ycSettings || !ycSettings.settings) {
    console.error("Configuração YCloud não encontrada.");
    return;
  }

  const ycloudConfig = ycSettings.settings;
  const firstName = msg.name ? msg.name.trim().split(' ')[0] : 'Cliente';

  let cleanPhone = msg.phone.replace(/\D/g, '');
  if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
  cleanPhone = '+' + cleanPhone;

  console.log(`🚀 Enviando para ${cleanPhone} via YCloud (Template: ${ycloudConfig.templateName})`);

  const ycloudUrl = `https://api.ycloud.com/v2/whatsapp/messages/sendDirectly`;
  
  try {
    const ycResponse = await fetch(ycloudUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ycloudConfig.apiKey
      },
      body: JSON.stringify({
        from: ycloudConfig.senderId || undefined,
        to: cleanPhone,
        type: 'template',
        template: {
          name: ycloudConfig.templateName,
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: firstName }
              ]
            }
          ]
        }
      })
    });

    const responseData = await ycResponse.json();

    if (!ycResponse.ok) {
       console.error(`\n❌ Falha no envio:`, JSON.stringify(responseData, null, 2));
    } else {
       console.log(`\n✅ SUCESSO! A mensagem foi disparada.`);
       console.log("Resposta:", JSON.stringify(responseData, null, 2));
       
       // Atualiza a mensagem para SENT
       await supabase.from('mass_messages').update({
           status: 'SENT',
           sent_at: new Date().toISOString()
       }).eq('id', msg.id);
       console.log("Mensagem marcada como SENT no banco.");
    }
  } catch (err) {
    console.error("Erro ao conectar na YCloud:", err);
  }
}

testOnePending();
