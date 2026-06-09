const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configurações e ambiente
const envPath = path.join(__dirname, '.env.local');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1] || '';
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

let evoBaseUrl = envContent.match(/VITE_EVOLUTION_API_URL=(.*)/)?.[1] || 'https://evolution-api-production-8ad2.up.railway.app';
let evoApiKey = envContent.match(/VITE_EVOLUTION_API_KEY=(.*)/)?.[1] || '429683C4C977415CAAFCCE10F7D57E11';

// Parâmetros de segurança Avançada (Anti-ban WhatsApp)
const MAX_MESSAGES_PER_DAY = 50;
const MIN_DELAY_MS = 3 * 60 * 1000; // Mínimo de 3 minutos
const MAX_DELAY_MS = 8 * 60 * 1000; // Máximo de 8 minutos
const CHECK_INTERVAL_MS = 1 * 60 * 1000; // 1 minuto checando se há pendentes

let isProcessing = false;

// Gera um tempo aleatório entre o min e max para o WhatsApp não detectar padrão robótico
function getRandomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

// Verifica se está dentro do horário comercial (09:00 às 18:00) para parecer humano
function isBusinessHours() {
  const hour = new Date().getHours();
  return hour >= 9 && hour < 18;
}

async function sendWhatsApp(instanceName, phone, text) {
  const cleanUrl = evoBaseUrl.replace(/\/$/, '');
  const url = `${cleanUrl}/message/sendText/${instanceName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': evoApiKey
    },
    body: JSON.stringify({
      number: phone,
      options: {
        delay: 4000, // Simula "Digitando..." por 4 segundos
        presence: 'composing' // Aparece "digitando..." lá no WhatsApp do cliente
      },
      text: text
    })
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('❌ Resposta da Evolution API (Status ' + response.status + '):', JSON.stringify(err, null, 2));
    
    let msg = response.statusText;
    if (err?.response?.message?.[0]?.exists === false) {
      msg = 'Número não possui WhatsApp registrado.';
    } else if (err?.message || err?.error) {
      msg = Array.isArray(err.message) ? err.message.join('; ') : (err.message || err.error);
    }
    
    throw new Error(msg);
  }
  return response.json();
}

async function processMassMessages() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // 1. Atualizar config da API do BD, se houver
    const { data: settings } = await supabase.from('api_settings').select('*').eq('service', 'evolution').maybeSingle();
    if (settings && settings.settings && settings.settings.baseUrl) {
      evoBaseUrl = settings.settings.baseUrl;
      evoApiKey = settings.settings.apiKey;
    }

    // 2. Buscar a primeira instância ativa (assumindo que o bot de disparo usará a instância principal)
    const { data: instances } = await supabase.from('whatsapp_instances').select('*').eq('is_active', true).limit(1);
    if (!instances || instances.length === 0) {
      console.log('⚠️ MassMessaging: Nenhuma instância WhatsApp ativa encontrada.');
      isProcessing = false;
      return;
    }
    const instanceName = instances[0].instance_name;

    // 3. Checar quantas já foram enviadas hoje
    const today = new Date().toISOString().split('T')[0];
    const { count, error: countError } = await supabase
      .from('mass_messages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'SENT')
      .gte('sent_at', `${today}T00:00:00Z`)
      .lte('sent_at', `${today}T23:59:59Z`);

    if (countError) throw countError;

    if ((count || 0) >= MAX_MESSAGES_PER_DAY) {
      console.log(`⏳ MassMessaging: Limite diário atingido (${MAX_MESSAGES_PER_DAY}). Pausando até amanhã.`);
      isProcessing = false;
      return;
    }

    // 4. Buscar a próxima mensagem pendente (apenas 1 por vez para não dar burst)
    const { data: pendingMsgs } = await supabase
      .from('mass_messages')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(1);

    if (!pendingMsgs || pendingMsgs.length === 0) {
      // Nada pendente
      isProcessing = false;
      return;
    }

    const msg = pendingMsgs[0];
    
    // 5. Preparar o texto (pega apenas o primeiro nome para ficar mais amigável)
    const firstName = msg.name ? msg.name.trim().split(' ')[0] : 'Cliente';
    const finalMessage = msg.message_template.replace(/\{\{?nome\}\}?/gi, firstName);

      if (!isBusinessHours()) {
        console.log(`🌙 MassMessaging: Fora do horário comercial. Dormindo por 1 hora...`);
        isProcessing = false;
        setTimeout(processMassMessages, 60 * 60 * 1000);
        return;
      }

      console.log(`📤 MassMessaging: Enviando para ${msg.phone} (Enviadas hoje: ${count || 0}/${MAX_MESSAGES_PER_DAY})...`);
      
      try {
        await sendWhatsApp(instanceName, msg.phone, finalMessage);
        
        // Atualiza como enviado
        await supabase.from('mass_messages').update({
          status: 'SENT',
          sent_at: new Date().toISOString()
        }).eq('id', msg.id);
        
        console.log(`✅ MassMessaging: Mensagem enviada para ${msg.phone} com sucesso.`);
        
        // Se sucesso, espera o tempo configurado
        const delayMs = getRandomDelay();
        console.log(`😴 MassMessaging: Comportamento Humano - Aguardando ${(delayMs / 1000 / 60).toFixed(1)} minutos para enviar a próxima...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
      } catch (sendError) {
      console.error(`❌ MassMessaging: Erro ao enviar para ${msg.phone}:`, sendError);
      // Atualiza com erro
      await supabase.from('mass_messages').update({
        status: 'ERROR',
        error_log: String(sendError)
      }).eq('id', msg.id);
    }

  } catch (error) {
    console.error('❌ MassMessaging: Erro geral no ciclo de verificação:', error);
  } finally {
    isProcessing = false;
  }
}

function init() {
  console.log('🔄 Iniciando Serviço de Ativação de Clientes (Disparo em Lote Anti-Ban)...');
  console.log(`⚙️ Configuração: Max ${MAX_MESSAGES_PER_DAY}/dia. Intervalo entre msgs: ${MIN_DELAY_MS / 1000 / 60} a ${MAX_DELAY_MS / 1000 / 60} min (Aleatório). Horário Comercial: Sim.`);
  
  // Chama imediatamente
  processMassMessages();
  
  // E depois a cada 1 minuto (ele só vai executar se isProcessing for false)
  setInterval(processMassMessages, CHECK_INTERVAL_MS);
}

init();
