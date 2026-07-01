-- Tabela de histórico de ações da IA (Gerente IA - Disparos)
CREATE TABLE IF NOT EXISTS public.ia_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_name TEXT,
    phone TEXT,
    type TEXT,
    seller_id UUID REFERENCES public.system_users(id) ON DELETE SET NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS e adicionar policies
ALTER TABLE public.ia_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.ia_dispatches
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.ia_dispatches
    FOR INSERT WITH CHECK (true);
