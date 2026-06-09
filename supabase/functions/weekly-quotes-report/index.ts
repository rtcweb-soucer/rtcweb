import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.2.1";

// As variáveis sensíveis virão do cofre do Supabase (Secrets), mas deixamos hardcoded as públicas ou já conhecidas para facilitar.
const EVOLUTION_URL = "https://evolution-api-production-8ad2.up.railway.app";
const EVOLUTION_API_KEY = "101f540987bec16185e6923c03db2652afc9e1fc968faba25b976f30a8d8f0aa";
const INSTANCE_NAME = "welelington";
const DIRECTOR_PHONE = "5521964592050";

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

serve(async (req) => {
    try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://xjryvzmejpzwzuroquur.supabase.co";
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; 
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "AIzaSyCdip8yN1Nh0rQh0aTW2Zkl3yOTwdzGncg";

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
            // Se falhar o Deno env, tentamos a anon key (se tivermos) - mas para edge functions usamos o que está no dashboard.
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_");

        console.log("Iniciando Weekly Quotes Report...");

        // 1. Buscar Orçamentos em Aberto Oficiais
        const { data: quotes, error: qError } = await supabase
            .from('orders')
            .select('*')
            .eq('status', 'QUOTE_SENT')
            .not('quote_number', 'is', null)
            .order('created_at', { ascending: false });

        if (qError) throw qError;
        if (!quotes || quotes.length === 0) {
            return new Response(JSON.stringify({ message: "Nenhum orçamento em aberto" }), { status: 200 });
        }

        const allCustomerIds = [...new Set(quotes.map((q: any) => q.customer_id).filter(Boolean))];

        // 2. Filtro de Falso Positivo: O cliente fechou algo nos últimos 60 dias?
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const { data: closedOrders } = await supabase
            .from('orders')
            .select('customer_id')
            .in('customer_id', allCustomerIds as string[])
            .in('status', ['CONTRACT_SIGNED', 'IN_PRODUCTION', 'FINISHED', 'DELIVERED'])
            .gte('created_at', sixtyDaysAgo.toISOString());

        const convertedCustomerIds = new Set(closedOrders?.map(o => o.customer_id) || []);

        // Filtrar as quotes tirando as dos clientes que fecharam algo recentemente
        const validQuotes = quotes.filter((q: any) => !convertedCustomerIds.has(q.customer_id));

        console.log(`De ${quotes.length} orçamentos, ${validQuotes.length} são válidos (restante foi descartado como alternativa).`);

        if (validQuotes.length === 0) {
            return new Response(JSON.stringify({ message: "Todos os orçamentos eram falsos positivos." }), { status: 200 });
        }

        // 3. Buscar nomes reais de Clientes, Vendedores e Produtos
        const validCustomerIds = [...new Set(validQuotes.map((q: any) => q.customer_id).filter(Boolean))];
        const { data: customers } = await supabase.from('customers').select('id, name, trade_name').in('id', validCustomerIds as string[]);
        
        const customerMap: Record<string, string> = {};
        if (customers) {
            customers.forEach(c => {
                customerMap[c.id] = c.trade_name || c.name || "Cliente Desconhecido";
            });
        }

        const { data: usersData } = await supabase.from('system_users').select('id, name');
        const { data: sellersData } = await supabase.from('sellers').select('id, name');
        const sellerMap: Record<string, string> = {};
        if (usersData) usersData.forEach(u => sellerMap[u.id] = u.name);
        if (sellersData) sellersData.forEach(s => sellerMap[s.id] = s.name);

        const { data: products } = await supabase.from('products').select('id, nome, tipo');
        const productMap: Record<string, string> = {};
        if (products) {
            products.forEach(p => productMap[p.id] = p.nome);
        }

        // 4. Agrupar dados por Vendedor
        const groupedData: Record<string, any> = {};

        for (const q of validQuotes) {
            const sellerName = sellerMap[q.seller_id] || "Vendedor Não Informado";
            const customerName = customerMap[q.customer_id] || q.customer_name || "Desconhecido";
            
            if (!groupedData[sellerName]) {
                groupedData[sellerName] = { totalValue: 0, quotes: [] };
            }

            let productNames: string[] = [];
            if (q.items_snapshot) {
                let items = [];
                try {
                    items = typeof q.items_snapshot === 'string' ? JSON.parse(q.items_snapshot) : q.items_snapshot;
                } catch(e){}
                if (Array.isArray(items)) {
                    const types = items.map(i => {
                        if (i.productType) return i.productType;
                        if (i.productId && productMap[i.productId]) return productMap[i.productId];
                        if (i.product_id && productMap[i.product_id]) return productMap[i.product_id];
                        return "Diversos";
                    });
                    productNames = [...new Set(types)].slice(0, 2);
                }
            }

            const qDate = new Date(q.created_at);
            const now = new Date();
            const isCurrentMonth = qDate.getMonth() === now.getMonth() && qDate.getFullYear() === now.getFullYear();

            groupedData[sellerName].quotes.push({
                customer: customerName,
                date: qDate.toLocaleDateString('pt-BR'),
                value: q.total_value,
                products: productNames.length > 0 ? productNames.join(', ') : "Diversos",
                isCurrentMonth
            });
            groupedData[sellerName].totalValue += (q.total_value || 0);
        }

        // 5. Enviar Mensagens via Gemini e Evolution API
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Buscar configuração da Evolution API
        const { data: evoSettings } = await supabase.from('api_settings').select('settings').eq('service', 'evolution').single();
        const baseUrl = evoSettings?.settings?.baseUrl || EVOLUTION_URL;
        const apiKey = evoSettings?.settings?.apiKey || EVOLUTION_API_KEY;

        const { data: inst } = await supabase.from('whatsapp_instances').select('instance_name').eq('is_active', true).limit(1);
        const instanceName = inst?.[0]?.instance_name || "welington";

        for (const [seller, data] of Object.entries(groupedData)) {
            let rawReport = `Vendedor: ${seller} (Total em aberto: ${formatCurrency(data.totalValue)})\n\n`;
            
            const currentMonthQuotes = data.quotes.filter((q: any) => q.isCurrentMonth);
            const retroactiveQuotes = data.quotes.filter((q: any) => !q.isCurrentMonth);

            rawReport += `[Orçamentos do Mês Vigente]\n`;
            if (currentMonthQuotes.length > 0) {
                currentMonthQuotes.forEach((q: any) => {
                    rawReport += `- Cliente: ${q.customer} | Data: ${q.date} | Valor: ${formatCurrency(q.value)} | Produtos: ${q.products}\n`;
                });
            } else {
                rawReport += `Nenhum orçamento novo este mês.\n`;
            }

            if (retroactiveQuotes.length > 0) {
                rawReport += `\n[Pendentes Retroativos (Meses Anteriores)]\n`;
                retroactiveQuotes.forEach((q: any) => {
                    rawReport += `- Cliente: ${q.customer} | Data: ${q.date} | Valor: ${formatCurrency(q.value)} | Produtos: ${q.products}\n`;
                });
            }

            const prompt = `Você é o Gerente IA de Vendas da RTC.
Transforme os dados abaixo em uma ÚNICA mensagem executiva e de cobrança AGRESSIVA de WhatsApp para o Diretor, referente ao vendedor ${seller}.
A mensagem deve ser dividida em duas partes:
1. "Orçamentos do Mês Vigente"
2. Como subtítulo, "Pendentes Retroativos" (mostrando os que ficaram parados de meses anteriores).
Exiba o nome do cliente, data, valor e produtos. Destaque o valor total. Use formatação de WhatsApp (negrito, emojis de fogo, alerta, etc).
DADOS: ${rawReport}`;

            let message = "";
            try {
                const result = await model.generateContent(prompt);
                message = result.response.text();
            } catch (e) {
                message = `*Orçamentos em Aberto - ${seller}*\n\n${rawReport.replace(/Vendedor:/g, '*Vendedor:*').replace(/Total em aberto:/g, '*Total na Mesa:*')}`;
            }

            const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: DIRECTOR_PHONE, text: message })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.error(`Erro Evolution API: Status ${response.status}`, JSON.stringify(err));
            }

            // Pausa de 3s para o WhatsApp não bloquear
            await new Promise(r => setTimeout(r, 3000));
        }

        return new Response(JSON.stringify({ success: true, processed: validQuotes.length }), { headers: { "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});
