const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Read env file manually
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

// We fetch gemini config dynamically
let geminiAi = null;
let directorPhone = '';

const ALERTS_FILE = path.join(__dirname, 'director_alerts_sent.json');

function loadAlerts() {
  if (fs.existsSync(ALERTS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveAlerts(alerts) {
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2), 'utf8');
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
      text: text
    })
  });
  
  if (!response.ok) {
    console.error(`Falha ao enviar alerta para ${phone}: ${response.statusText}`);
  }
}

async function init() {
  console.log('🔄 Iniciando Monitor de Vendas Paradas e Alertas do Diretor...');
  
  // 1. Fetch system settings
  const { data: settings } = await supabase.from('api_settings').select('*');
  const geminiConfig = settings?.find(s => s.service === 'gemini')?.settings;
  const evoConfig = settings?.find(s => s.service === 'evolution')?.settings;
  
  if (evoConfig && evoConfig.baseUrl) {
    // Override default if found in DB
    evoBaseUrl = evoConfig.baseUrl;
    evoApiKey = evoConfig.apiKey;
  }
  
  if (!geminiConfig || !geminiConfig.apiKey) {
    console.log('❌ API Key do Gemini não encontrada nas configurações. Monitor abortado.');
    return;
  }
  
  if (!geminiConfig.directorPhone) {
    console.log('❌ WhatsApp do Diretor não configurado. Monitor abortado.');
    return;
  }
  
  geminiAi = new GoogleGenerativeAI(geminiConfig.apiKey);
  directorPhone = geminiConfig.directorPhone;
  
  const HOURS_LIMIT = geminiConfig.quoteGraceDirector || 2;
  
  console.log(`✅ Monitor configurado. Limite de carência: ${HOURS_LIMIT}h. Diretor: ${directorPhone}`);
  
  setInterval(() => checkStaleQuotes(HOURS_LIMIT), 10 * 60 * 1000); // 10 minutes
  checkStaleQuotes(HOURS_LIMIT); // Run immediately
}

async function checkStaleQuotes(hoursLimit) {
  try {
    console.log('🔍 Varrendo orçamentos em fechamento...');
    const alertsSent = loadAlerts();
    
    // Fetch quotes
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_value, customer_id, seller_id, created_at, status')
      .eq('status', 'QUOTE_SENT');
      
    if (!orders || orders.length === 0) return;
    
    // Fetch sellers
    const { data: sellers } = await supabase.from('users').select('id, name');
    const { data: customers } = await supabase.from('customers').select('id, name, phone, phone2');
    
    for (const order of orders) {
      if (alertsSent[order.id]) continue; // Already alerted
      
      const customer = (customers || []).find(c => c.id === order.customer_id);
      const seller = (sellers || []).find(s => s.id === order.seller_id);
      
      if (!customer) continue;
      
      // Get all customer phones
      const p1 = (customer.phone || '').replace(/\D/g, '');
      const p2 = (customer.phone2 || '').replace(/\D/g, '');
      
      // Fetch latest messages for this customer
      const { data: msgs } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .or(`customer_phone.like.%${p1}%,customer_phone.like.%${p2}%`)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (!msgs || msgs.length === 0) continue;
      
      // Check last inbound message
      const lastInbound = msgs.find(m => m.direction === 'inbound');
      if (!lastInbound) continue;
      
      const hoursSinceInbound = (new Date().getTime() - new Date(lastInbound.created_at).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceInbound >= hoursLimit) {
        console.log(`⚠️ Orçamento ${order.id} travado! Analisando com IA...`);
        
        // Prepare context for Gemini
        const chatHistory = msgs.reverse().map(m => `${m.direction === 'inbound' ? 'Cliente' : 'Vendedor'}: ${m.message}`).join('\n');
        
        const prompt = `
Você é uma IA assistente de diretoria de uma fábrica de toldos. 
Uma venda do vendedor ${seller?.name || 'Desconhecido'} para o cliente ${customer.name} no valor de R$ ${order.total_value.toFixed(2)} está PARADA há mais de ${Math.floor(hoursSinceInbound)} horas.
O orçamento foi enviado, mas não foi fechado nem perdido.

Aqui estão as últimas mensagens trocadas:
${chatHistory}

Escreva uma MENSAGEM CURTA E DIRETA (máximo 4 linhas) para ser enviada no WhatsApp do DIRETOR da empresa.
Diga:
1. Qual é o vendedor e o valor do orçamento parado.
2. O que aconteceu na conversa (ex: cliente pediu desconto e vendedor sumiu, ou cliente visualizou e ignorou).
Use formato WhatsApp (asteriscos para negrito). Não adicione saudações longas, vá direto ao ponto.
`;

        const model = geminiAi.getGenerativeModel({ model: 'gemini-2.5-pro' });
        const result = await model.generateContent(prompt);
        const aiAnalysis = result.response.text();
        
        const finalAlertMessage = `🚨 *ALERTA DE VENDA PARADA* 🚨\n\n${aiAnalysis}`;
        
        // Send WhatsApp
        // We use the seller's instance to send the message to the director? Or a generic one?
        // Since we don't know the exact instance, we can fetch all instances and pick the first connected one.
        const { data: insts } = await supabase.from('whatsapp_instances').select('name, status').eq('status', 'open');
        const instance = (insts && insts.length > 0) ? insts[0].name : 'welington'; // fallback
        
        await sendWhatsApp(instance, directorPhone, finalAlertMessage);
        
        console.log(`✅ Alerta enviado ao Diretor sobre o pedido ${order.id}.`);
        alertsSent[order.id] = new Date().toISOString();
        saveAlerts(alertsSent);
      }
    }
  } catch (error) {
    console.error('❌ Erro no ciclo de verificação:', error);
  }
}

init();
