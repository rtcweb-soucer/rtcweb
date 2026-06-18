import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async (req) => {
    try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://xjryvzmejpzwzuroquur.supabase.co";
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; 

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error("Missing SUPABASE_SERVICE_ROLE_KEY in Deno Environment");
            return new Response(JSON.stringify({ error: "Missing config" }), { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Verificar horário comercial (Brasil - BRT é UTC-3)
        const now = new Date();
        const brtHour = (now.getUTCHours() - 3 + 24) % 24;
        
        if (brtHour < 9 || brtHour >= 18) {
            return new Response(JSON.stringify({ message: "Fora do horário comercial. Ignorado." }), { status: 200 });
        }

        // 2. Verificar limite de 50 mensagens enviadas hoje
        const today = now.toISOString().split('T')[0];
        const { count, error: countError } = await supabase
            .from('mass_messages')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'SENT')
            .gte('sent_at', today + 'T00:00:00Z');

        if (countError) throw countError;

        if (count && count >= 50) {
            return new Response(JSON.stringify({ message: `Limite diário de 50 mensagens atingido (${count}).` }), { status: 200 });
        }

        // 3. Buscar mensagens pendentes e ordenar pela sequência de anos
        const { data: pendingMsgs, error: msgError } = await supabase
            .from('mass_messages')
            .select('*')
            .eq('status', 'PENDING')
            .limit(5000); // Pega lote grande para ordenar em memória

        if (msgError) throw msgError;

        if (!pendingMsgs || pendingMsgs.length === 0) {
            return new Response(JSON.stringify({ message: "Fila vazia." }), { status: 200 });
        }

        // Sequência exigida: 2020, 2021, 2022, 2023, 2024, 2015, 2016, 2017, 2018, 2019
        const yearPriority: Record<string, number> = {
            '2020': 1, '2021': 2, '2022': 3, '2023': 4, '2024': 5,
            '2015': 6, '2016': 7, '2017': 8, '2018': 9, '2019': 10
        };

        pendingMsgs.sort((a, b) => {
            const dateA = a.metadata && a.metadata['Última compra'] ? String(a.metadata['Última compra']).split('/').pop() || '9999' : '9999';
            const dateB = b.metadata && b.metadata['Última compra'] ? String(b.metadata['Última compra']).split('/').pop() || '9999' : '9999';
            
            const priorityA = yearPriority[dateA] || 99;
            const priorityB = yearPriority[dateB] || 99;
            
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        const msg = pendingMsgs[0];
        const firstName = msg.name ? msg.name.trim().split(' ')[0] : 'Cliente';

        // 4. Buscar configuração da YCloud (Substituindo a antiga Evolution)
        const { data: ycSettings } = await supabase
            .from('api_settings')
            .select('*')
            .eq('service', 'ycloud')
            .single();

        if (!ycSettings || !ycSettings.settings || !ycSettings.settings.apiKey || !ycSettings.settings.templateName) {
            return new Response(JSON.stringify({ error: "Configuração da YCloud ausente ou incompleta. Configure no painel." }), { status: 500 });
        }

        const ycloudConfig = ycSettings.settings;
        const ycloudUrl = "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly";

        let cleanPhone = msg.phone.replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
        cleanPhone = '+' + cleanPhone;

        // 5. Enviar usando a API Oficial (YCloud)
        const response = await fetch(ycloudUrl, {
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

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            let errorLog = response.statusText;
            if (err?.message || err?.error) {
                errorLog = Array.isArray(err.message) ? err.message.join('; ') : (err.message || err.error);
            }
            
            await supabase.from('mass_messages').update({
                status: 'ERROR',
                error_log: `Erro YCloud: ${JSON.stringify(errorLog)}`
            }).eq('id', msg.id);

            return new Response(JSON.stringify({ message: `Erro ao enviar via YCloud: ${errorLog}` }), { status: 200 });
        }

        // Sucesso
        await supabase.from('mass_messages').update({
            status: 'SENT',
            sent_at: new Date().toISOString(),
            error_log: null
        }).eq('id', msg.id);

        return new Response(JSON.stringify({ success: true, phone: msg.phone }), { headers: { "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("Erro na Edge Function:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});
