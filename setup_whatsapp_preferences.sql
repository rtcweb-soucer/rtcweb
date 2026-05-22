-- Tabela para armazenar as preferências de WhatsApp do cliente, como opt-out e intenção de compra
CREATE TABLE IF NOT EXISTS public.customer_whatsapp_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_phone VARCHAR(50) UNIQUE NOT NULL,
    opt_out BOOLEAN DEFAULT false,
    last_intent VARCHAR(50),
    last_analyzed_message_id UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permissões
ALTER TABLE public.customer_whatsapp_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to authenticated users on preferences"
ON public.customer_whatsapp_preferences
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Função para auto-atualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_customer_whatsapp_prefs_modtime ON public.customer_whatsapp_preferences;
CREATE TRIGGER update_customer_whatsapp_prefs_modtime
    BEFORE UPDATE ON public.customer_whatsapp_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_whatsapp_prefs_updated_at();
