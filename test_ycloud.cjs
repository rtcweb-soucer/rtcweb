const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function testYCloud() {
  const envPath = path.join(__dirname, '.env.local');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  } else {
    console.log('Arquivo .env.local não encontrado!');
    process.exit(1);
  }
  
  const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1] || '';
  const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1] || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Buscando configurações da YCloud no banco de dados...");
  const { data: ycSettings, error } = await supabase.from('api_settings').select('*').eq('service', 'ycloud').maybeSingle();
  
  if (error || !ycSettings || !ycSettings.settings) {
    console.error("Erro ao buscar configurações no banco de dados. Você clicou em 'Salvar' lá na tela?");
    process.exit(1);
  }

  const ycloudConfig = ycSettings.settings;
  console.log("Configurações encontradas!");
  console.log("Template:", ycloudConfig.templateName);
  console.log("Sender ID:", ycloudConfig.senderId);

  // Pega o número passado como argumento ou usa um padrão
  let testPhone = process.argv[2];
  if (!testPhone) {
    console.log("\n⚠️ ATENÇÃO: Para testar o envio, rode o script passando o número do seu celular com DDD.");
    console.log("Exemplo: node test_ycloud.cjs 21999998888\n");
    process.exit(1);
  }

  // Formata o número (remover + e garantir DDI)
  let cleanPhone = testPhone.replace(/\D/g, '');
  if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
  cleanPhone = '+' + cleanPhone;

  console.log(`\n🚀 Enviando mensagem de teste via YCloud para o número: ${cleanPhone}`);
  
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
          language: {
            code: 'pt_BR'
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: 'Teste' // Variável {{1}}
                }
              ]
            }
          ]
        }
      })
    });

    const responseData = await ycResponse.json();

    if (!ycResponse.ok) {
       console.error(`\n❌ Erro retornado pela YCloud:`, JSON.stringify(responseData, null, 2));
    } else {
       console.log(`\n✅ SUCESSO! A mensagem foi disparada pela YCloud.`);
       console.log("Resposta da API:", JSON.stringify(responseData, null, 2));
    }
  } catch (err) {
    console.error("Erro ao conectar na YCloud:", err);
  }
}

testYCloud();
