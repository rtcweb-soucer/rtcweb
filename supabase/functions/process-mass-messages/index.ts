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

        // 3. Buscar 1 mensagem pendente
        const { data: messages, error: msgError } = await supabase
            .from('mass_messages')
            .select('*')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true })
            .limit(1);

        if (msgError) throw msgError;

        if (!messages || messages.length === 0) {
            return new Response(JSON.stringify({ message: "Fila vazia." }), { status: 200 });
        }

        const msg = messages[0];

        // Formatar texto substituindo {nome}
        const firstName = msg.name ? msg.name.trim().split(' ')[0] : 'Cliente';
        const finalMessage = msg.message_template.replace(/\{\{?nome\}\}?/gi, firstName);

        // 4. Buscar configuração da Evolution API
        const { data: evoSettings } = await supabase
            .from('api_settings')
            .select('settings')
            .eq('service', 'evolution')
            .single();

        const baseUrl = evoSettings?.settings?.baseUrl || "https://evolution-api-production-8ad2.up.railway.app";
        const apiKey = evoSettings?.settings?.apiKey || "429683C4C977415CAAFCCE10F7D57E11";
        const cleanUrl = baseUrl.replace(/\/$/, '');

        const { data: inst } = await supabase
            .from('whatsapp_instances')
            .select('instance_name')
            .eq('is_active', true)
            .limit(1);
        const instanceName = inst?.[0]?.instance_name || "welelington";

        // 5. Enviar para Evolution API com delay de digitação
        const url = `${cleanUrl}/message/sendText/${instanceName}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: msg.phone,
                options: {
                    delay: 4000,
                    presence: 'composing'
                },
                text: finalMessage
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            let errorLog = response.statusText;
            if (err?.response?.message?.[0]?.exists === false) {
                errorLog = 'Número não possui WhatsApp registrado.';
            } else if (err?.message || err?.error) {
                errorLog = Array.isArray(err.message) ? err.message.join('; ') : (err.message || err.error);
            }
            
            // Marcar como erro
            await supabase.from('mass_messages').update({
                status: 'ERROR',
                error_log: errorLog
            }).eq('id', msg.id);

            return new Response(JSON.stringify({ message: `Erro ao enviar: ${errorLog}` }), { status: 200 });
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
