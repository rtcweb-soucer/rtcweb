import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configs
const SUPABASE_URL = "https://xjryvzmejpzwzuroquur.supabase.co";
const SUPABASE_KEY = "sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_";

const GEMINI_API_KEY = "AIzaSyCdip8yN1Nh0rQh0aTW2Zkl3yOTwdzGncg";
const EVOLUTION_URL = "https://evolution-api-production-8ad2.up.railway.app";
const EVOLUTION_API_KEY = "101f540987bec16185e6923c03db2652afc9e1fc968faba25b976f30a8d8f0aa";
const INSTANCE_NAME = "welelington";
const DIRECTOR_PHONE = "5521964592050";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    try {
        console.log("Buscando dados de Produção no Supabase...");
        
        const { data: orders, error: qError } = await supabase
            .from('orders')
            .select('id, contract_number, customer_id, status, production_stage, delivery_deadline, items_snapshot')
            .in('status', ['CONTRACT_SIGNED', 'IN_PRODUCTION']);

        if (qError) throw qError;

        if (!orders || orders.length === 0) {
            console.log("Nenhum pedido em produção.");
            return;
        }

        // Buscar Clientes
        const customerIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];
        const { data: customers } = await supabase.from('customers').select('id, name, trade_name').in('id', customerIds);
        const customerMap = {};
        if (customers) {
            customers.forEach(c => { customerMap[c.id] = c.trade_name || c.name || "Desconhecido"; });
        }

        // Buscar Tracking de Produção Real
        const { data: trackingData } = await supabase.from('production_tracking').select('*');
        const trackingMap = {};
        if (trackingData) {
            trackingData.forEach(t => { trackingMap[t.order_id] = t; });
        }

        const now = new Date();
        let delayedOrders = [];
        let onTimeCount = 0;
        let stageCounts = {};

        for (const o of orders) {
            const track = trackingMap[o.id];
            const stage = track?.stage || o.production_stage || 'Aguardando PCP';
            if (!stageCounts[stage]) stageCounts[stage] = 0;
            stageCounts[stage]++;

            if (o.delivery_deadline && new Date(o.delivery_deadline) < now) {
                const customerName = customerMap[o.customer_id] || "Desconhecido";
                
                // Produtos
                let products = "Diversos";
                if (o.items_snapshot) {
                    try {
                        const items = typeof o.items_snapshot === 'string' ? JSON.parse(o.items_snapshot) : o.items_snapshot;
                        if (Array.isArray(items)) {
                            products = [...new Set(items.map(i => i.productType || "Produto"))].join(', ');
                        }
                    } catch(e){}
                }

                const daysDelayed = Math.floor((now.getTime() - new Date(o.delivery_deadline).getTime()) / (1000 * 3600 * 24));

                delayedOrders.push({
                    contract: o.contract_number || o.id.substring(0, 8),
                    customer: customerName,
                    stage: stage,
                    daysDelayed: daysDelayed,
                    products: products
                });
            } else {
                onTimeCount++;
            }
        }

        delayedOrders.sort((a, b) => b.daysDelayed - a.daysDelayed);

        let rawReport = `RESUMO DA PRODUÇÃO (PCP)\n\n`;
        rawReport += `Pedidos no Prazo: ${onTimeCount}\n`;
        rawReport += `Pedidos Atrasados: ${delayedOrders.length}\n\n`;
        rawReport += `--- VOLUME POR ETAPA ---\n`;
        for (const [stage, count] of Object.entries(stageCounts)) {
            rawReport += `- ${stage}: ${count} pedidos\n`;
        }

        rawReport += `\n--- DETALHAMENTO DOS ATRASOS ---\n`;
        if (delayedOrders.length === 0) {
            rawReport += `Nenhum pedido em atraso. Parabéns à equipe!\n`;
        } else {
            delayedOrders.forEach(d => {
                rawReport += `Cliente: ${d.customer} | Pedido: ${d.contract} | Etapa Atual: ${d.stage} | Atraso: ${d.daysDelayed} dias | Produto(s): ${d.products}\n\n`;
            });
        }

        console.log("Gerando mensagem com Gemini...");
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        
        const prompt = `Você é o Diretor de Produção e Logística IA da RTC.
Sua tarefa é ler os dados brutos de produção e gerar uma mensagem executiva de WhatsApp para o Diretor Geral, reportando o status da fábrica.
A mensagem deve:
1. Começar com um resumo geral (quantos no prazo, quantos atrasados).
2. Mostrar um breve "Raio-X" da fábrica (quais etapas têm mais pedidos parados).
3. Listar de forma CLARA e DESTACADA os pedidos que estão em atraso, ordenando do mais atrasado para o menos, citando Cliente, Etapa travada, e quantos dias de atraso.
4. Ter um tom firme de cobrança operacional, sugerindo que as etapas com gargalos sejam destravadas. Use emojis como 🚨, 🏭, 📉, 📊.
5. EXTREMAMENTE IMPORTANTE: Pule uma linha (dê um espaço em branco) entre cada pedido na lista para facilitar a leitura no celular.

DADOS DA PRODUÇÃO:
${rawReport}
`;
        
        let message = "";
        try {
            const result = await model.generateContent(prompt);
            message = result.response.text();
        } catch(e) {
            console.log("Erro no Gemini. Tentando sem IA...");
            message = rawReport;
        }

        console.log("Mensagem Pronta:\n", message);

        console.log("Enviando via Evolution API...");
        const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: DIRECTOR_PHONE,
                text: message
            })
        });

        if (response.ok) {
            console.log("✅ Relatório de PCP enviado com sucesso!");
        } else {
            console.error("❌ Erro ao enviar:", await response.json());
        }

    } catch (err) {
        console.error("Erro fatal:", err);
    }
}

run();
