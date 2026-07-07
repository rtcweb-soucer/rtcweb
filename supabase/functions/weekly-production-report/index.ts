import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.2.1";

const EVOLUTION_URL = "https://evolution-api-production-8ad2.up.railway.app";
const EVOLUTION_API_KEY = "101f540987bec16185e6923c03db2652afc9e1fc968faba25b976f30a8d8f0aa";
const INSTANCE_NAME = "welelington";
const TARGET_PHONES = [
    "5521964592050", // Joao
    "5521990788880", // Aline
    "5521986124416", // Welington
    // "5521..." // Denis (to be filled)
];

serve(async (req) => {
    try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://xjryvzmejpzwzuroquur.supabase.co";
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_"; 
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "AIzaSyCdip8yN1Nh0rQh0aTW2Zkl3yOTwdzGncg";

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const { data: orders, error: qError } = await supabase
            .from('orders')
            .select('id, contract_number, customer_id, status, production_stage, delivery_deadline, items_snapshot')
            .in('status', ['CONTRACT_SIGNED', 'IN_PRODUCTION']);

        if (qError) throw qError;

        if (!orders || orders.length === 0) {
            return new Response(JSON.stringify({ message: "Nenhum pedido em produção" }), { status: 200 });
        }

        const customerIds = [...new Set(orders.map((o: any) => o.customer_id).filter(Boolean))];
        const { data: customers } = await supabase.from('customers').select('id, name, trade_name').in('id', customerIds as string[]);
        const customerMap: Record<string, string> = {};
        if (customers) {
            customers.forEach(c => { customerMap[c.id] = c.trade_name || c.name || "Desconhecido"; });
        }

        // Buscar Tracking de Produção Real
        const { data: trackingData } = await supabase.from('production_tracking').select('*');
        const trackingMap: Record<string, any> = {};
        if (trackingData) {
            trackingData.forEach(t => { trackingMap[t.order_id] = t; });
        }

        const now = new Date();
        let delayedOrders: any[] = [];
        let onTimeCount = 0;
        let stageCounts: Record<string, number> = {};

        for (const o of orders) {
            const track = trackingMap[o.id];
            const stage = track?.stage || o.production_stage || 'Aguardando PCP';
            if (!stageCounts[stage]) stageCounts[stage] = 0;
            stageCounts[stage]++;

            if (o.delivery_deadline && new Date(o.delivery_deadline) < now) {
                const customerName = customerMap[o.customer_id] || "Desconhecido";
                
                let products = "Diversos";
                if (o.items_snapshot) {
                    try {
                        const items = typeof o.items_snapshot === 'string' ? JSON.parse(o.items_snapshot) : o.items_snapshot;
                        if (Array.isArray(items)) {
                            products = [...new Set(items.map((i: any) => i.productType || "Produto"))].join(', ');
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
            message = rawReport;
        }

        // Buscar configuração da Evolution API
        const { data: evoSettings } = await supabase.from('api_settings').select('settings').eq('service', 'evolution').single();
        const baseUrl = evoSettings?.settings?.baseUrl || EVOLUTION_URL;
        const apiKey = evoSettings?.settings?.apiKey || EVOLUTION_API_KEY;

        const { data: inst } = await supabase.from('whatsapp_instances').select('instance_name').eq('is_active', true).limit(1);
        const instanceName = inst?.[0]?.instance_name || "welington";

        for (const phone of TARGET_PHONES) {
            const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: {
                    'apikey': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    number: phone,
                    text: message
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.error(`Erro Evolution API para ${phone}: Status ${response.status}`, JSON.stringify(err));
            }
        }

        return new Response(JSON.stringify({ success: true, processed: delayedOrders.length }), { headers: { "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});
