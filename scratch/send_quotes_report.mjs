import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configs
const SUPABASE_URL = "https://xjryvzmejpzwzuroquur.supabase.co";
const SUPABASE_KEY = "sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_"; // Anon key

const GEMINI_API_KEY = "AIzaSyCdip8yN1Nh0rQh0aTW2Zkl3yOTwdzGncg";
const EVOLUTION_URL = "https://evolution-api-production-8ad2.up.railway.app";
const EVOLUTION_API_KEY = "101f540987bec16185e6923c03db2652afc9e1fc968faba25b976f30a8d8f0aa";
const INSTANCE_NAME = "welelington";
const DIRECTOR_PHONE = "5521964592050";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

async function run() {
    try {
        console.log("Buscando dados no Supabase...");
        
        // 1. Buscar Vendedores
        const { data: usersData } = await supabase.from('system_users').select('id, name');
        const { data: sellersData } = await supabase.from('sellers').select('id, name');
        
        const sellerMap = {};
        if (usersData) usersData.forEach(u => sellerMap[u.id] = u.name);
        if (sellersData) sellersData.forEach(s => sellerMap[s.id] = s.name);

        // 3. Buscar Orçamentos em Aberto (QUOTE_SENT) OFICIAIS (com quote_number)
        const { data: quotes, error: qError } = await supabase
            .from('orders')
            .select('*')
            .eq('status', 'QUOTE_SENT')
            .not('quote_number', 'is', null)
            .order('created_at', { ascending: false });

        if (qError) throw qError;

        if (!quotes || quotes.length === 0) {
            console.log("Nenhum orçamento oficial em aberto encontrado.");
            return;
        }

        // 2. Buscar Clientes sob demanda (para evitar limite de 1000 linhas)
        const customerIds = [...new Set(quotes.map(q => q.customer_id).filter(Boolean))];
        const { data: customers } = await supabase
            .from('customers')
            .select('id, name, trade_name')
            .in('id', customerIds);
            
        const customerMap = {};
        if (customers) {
            customers.forEach(c => {
                customerMap[c.id] = c.trade_name || c.name || "Cliente Desconhecido";
            });
        }

        // 4. Buscar nomes dos produtos para tentar mapear IDs
        const { data: products } = await supabase.from('products').select('id, nome, tipo');
        const productMap = {};
        if (products) {
            products.forEach(p => productMap[p.id] = p.nome);
        }

        console.log(`Encontrados ${quotes.length} orçamentos em aberto.`);

        // Agrupar por vendedor e formatar dados brutos
        const groupedData = {};

        for (const q of quotes) {
            const sellerName = sellerMap[q.seller_id] || "Vendedor Não Informado";
            const customerName = customerMap[q.customer_id] || q.customer_name || "Desconhecido";
            
            if (!groupedData[sellerName]) {
                groupedData[sellerName] = {
                    totalValue: 0,
                    quotes: []
                };
            }

            // Descobrir produtos predominantes
            let productNames = [];
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
                    productNames = [...new Set(types)].slice(0, 2); // Pega os 2 primeiros tipos
                }
            }

            const productsStr = productNames.length > 0 ? productNames.join(', ') : "Produtos Diversos";

            groupedData[sellerName].quotes.push({
                customer: customerName,
                date: new Date(q.created_at).toLocaleDateString('pt-BR'),
                value: q.total_value,
                products: productsStr
            });
            groupedData[sellerName].totalValue += (q.total_value || 0);
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        for (const [seller, data] of Object.entries(groupedData)) {
            let rawReport = `Vendedor: ${seller} (Total em aberto: ${formatCurrency(data.totalValue)})\n`;
            data.quotes.forEach(q => {
                rawReport += `- Cliente: ${q.customer} | Data: ${q.date} | Valor: ${formatCurrency(q.value)} | Produtos: ${q.products}\n`;
            });

            console.log(`Gerando mensagem para o vendedor: ${seller}...`);
            const prompt = `Você é o Gerente IA de Vendas da RTC.
Transforme os dados brutos abaixo em uma ÚNICA mensagem executiva de WhatsApp para o Diretor, referente EXCLUSIVAMENTE ao vendedor ${seller}.
Exiba o nome do cliente, a data, o valor e os produtos de cada orçamento.
Dê destaque ao valor total em aberto que esse vendedor possui na mesa.
Use formatação de WhatsApp (negrito, emojis).

DADOS DO VENDEDOR:
${rawReport}
`;

            let message = "";
            try {
                const result = await model.generateContent(prompt);
                message = result.response.text();
            } catch (e) {
                console.log("Erro no Gemini. Enviando versão sem IA para " + seller);
                message = `*Orçamentos em Aberto - ${seller}*\n\n${rawReport.replace(/Vendedor:/g, '*Vendedor:*').replace(/Total em aberto:/g, '*Total na Mesa:*')}`;
            }

            console.log(`Enviando mensagem do vendedor ${seller}...`);
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
                console.log(`✅ Mensagem de ${seller} enviada com sucesso!`);
            } else {
                console.error(`❌ Erro ao enviar mensagem de ${seller}:`, await response.json());
            }

            // Aguarda 3 segundos antes de enviar a próxima para não sobrecarregar o WhatsApp
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

    } catch (err) {
        console.error("Erro fatal no script:", err);
    }
}

run();
