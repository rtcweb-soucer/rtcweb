import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

serve(async (req) => {
    try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://xjryvzmejpzwzuroquur.supabase.co";
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; 

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error("Missing SUPABASE_SERVICE_ROLE_KEY in Deno Environment");
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_");

        const payload = await req.json();
        const { order_id, stage, old_stage, type, requester_name, notes, items } = payload;
        
        // Se for uma solicitação de compra, a etapa de disparo é 'Provisionamento'
        const targetStage = type === 'purchase_request' ? 'Provisionamento' : stage;

        console.log(`Recebido gatilho. Tipo: ${type || 'stage_change'} | Pedido: ${order_id} | Etapa Alvo: ${targetStage}`);

        if (!order_id || (!stage && !type)) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
        }

        // 1. Buscar contatos ativos cadastrados para essa nova etapa
        const { data: contacts, error: cError } = await supabase
            .from('team_notifications')
            .select('*')
            .eq('stage_trigger', targetStage)
            .eq('active', true);

        if (cError) throw cError;

        if (!contacts || contacts.length === 0) {
            console.log(`Nenhum contato cadastrado ou ativo para a etapa: "${targetStage}"`);
            return new Response(JSON.stringify({ message: "No contacts to notify." }), { status: 200 });
        }

        // 2. Buscar detalhes do pedido
        const { data: order, error: oError } = await supabase
            .from('orders')
            .select('contract_number, customer_id, items_snapshot, total_value')
            .eq('id', order_id)
            .single();

        if (oError) throw oError;

        // 3. Buscar detalhes do cliente
        let customerName = "Desconhecido";
        if (order.customer_id) {
            const { data: customer } = await supabase
                .from('customers')
                .select('name, trade_name')
                .eq('id', order.customer_id)
                .single();
            if (customer) {
                customerName = customer.trade_name || customer.name || "Desconhecido";
            }
        }

        // 4. Mapear produtos
        let products = "Diversos";
        if (order.items_snapshot) {
            try {
                const items = typeof order.items_snapshot === 'string' ? JSON.parse(order.items_snapshot) : order.items_snapshot;
                if (Array.isArray(items)) {
                    products = [...new Set(items.map((i: any) => i.productType || "Produto"))].join(', ');
                }
            } catch(e){}
        }

        const contract = order.contract_number || order_id.substring(0, 8);
        const totalValue = order.total_value || 0;

        // 5. Buscar configurações da Evolution API
        const { data: evoSettings } = await supabase
            .from('api_settings')
            .select('settings')
            .eq('service', 'evolution')
            .single();

        const baseUrl = evoSettings?.settings?.baseUrl || "https://evolution-api-production-8ad2.up.railway.app";
        const apiKey = evoSettings?.settings?.apiKey || "101f540987bec16185e6923c03db2652afc9e1fc968faba25b976f30a8d8f0aa";

        const { data: inst } = await supabase
            .from('whatsapp_instances')
            .select('instance_name')
            .eq('is_active', true)
            .limit(1);
        const instanceName = inst?.[0]?.instance_name || "welelington";

        // 6. Enviar a mensagem personalizada para cada contato cadastrado
        for (const contact of contacts) {
            let message = "";

            if (type === 'purchase_request') {
                let itemsList = "";
                if (Array.isArray(items)) {
                    itemsList = items.map((i: any) => `- *${i.name}*: ${i.quantity} ${i.unit || 'un'}`).join('\n');
                } else {
                    itemsList = "- Nenhum item listado.";
                }
                message = `🛒 *NOVA SOLICITAÇÃO DE COMPRA*\n\nOlá *${contact.name}*,\nUma nova solicitação de material foi gerada no PCP para o pedido abaixo:\n\n*Contrato:* ${contract}\n*Cliente:* ${customerName}\n*Solicitante:* ${requester_name || 'PCP'}\n\n*Itens Solicitados:*\n${itemsList}\n\n${notes ? `*Observações:* ${notes}` : ''}`;
            } else if (stage === 'Novos Pedidos') {
                message = `🚨 *NOVO PEDIDO NO PCP!*\n\nOlá *${contact.name}*,\nUm novo pedido foi fechado e precisa ser preparado no PCP/PCN:\n\n*Contrato:* ${contract}\n*Cliente:* ${customerName}\n*Produtos:* ${products}\n*Valor Total:* ${formatCurrency(totalValue)}\n\nPor favor, acesse o sistema e realize a classificação/preparação.`;
            } else if (stage === 'Em Preparação') {
                message = `🏭 *PEDIDO EM PREPARAÇÃO!*\n\nOlá *${contact.name}*,\nO seguinte pedido avançou para a etapa de produção física (*Em Preparação*):\n\n*Contrato:* ${contract}\n*Cliente:* ${customerName}\n*Produtos:* ${products}\n\nStatus atualizado na fábrica com sucesso.`;
            } else if (stage === 'Provisionamento') {
                message = `🛒 *PEDIDO EM PROVISIONAMENTO (COMPRAS)*\n\nOlá *${contact.name}*,\nO pedido abaixo entrou em *Provisionamento*. É necessário verificar a compra/reserva de materiais:\n\n*Contrato:* ${contract}\n*Cliente:* ${customerName}\n*Produtos:* ${products}\n\nFavor providenciar os materiais necessários.`;
            } else {
                // Mensagem genérica para outras etapas futuras
                message = `📦 *ATUALIZAÇÃO DE PEDIDO - RTC*\n\nOlá *${contact.name}*,\nO pedido abaixo foi movido para a etapa de *${stage}*:\n\n*Contrato:* ${contract}\n*Cliente:* ${customerName}\n*Produtos:* ${products}\n\nStatus atualizado com sucesso.`;
            }

            console.log(`Enviando mensagem para ${contact.name} (${contact.phone})...`);

            const url = `${baseUrl}/message/sendText/${instanceName}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    number: contact.phone,
                    text: message
                })
            });

            if (!response.ok) {
                console.error(`Falha ao enviar mensagem para ${contact.name}: ${response.statusText}`);
            } else {
                console.log(`Mensagem enviada com sucesso para ${contact.name}!`);
            }

            // Delay de 1.5s entre envios para evitar rate limit
            await new Promise(r => setTimeout(r, 1500));
        }

        return new Response(JSON.stringify({ success: true, notified: contacts.length }), { headers: { "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("Erro na Edge Function:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});
