-- Script para criar a tabela de contatos de notificação da equipe
CREATE TABLE IF NOT EXISTS public.team_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    stage_trigger TEXT NOT NULL, -- ex: 'Novos Pedidos', 'Em Preparação', 'Provisionamento'
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.team_notifications ENABLE ROW LEVEL SECURITY;

-- Política de acesso total público para alinhar com o padrão do projeto
DROP POLICY IF EXISTS "Enable all access for all users on team_notifications" ON public.team_notifications;
CREATE POLICY "Enable all access for all users on team_notifications" 
ON public.team_notifications FOR ALL TO public USING (true) WITH CHECK (true);

-- Gatilho de Atualização do updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS on_team_notifications_updated ON public.team_notifications;
CREATE TRIGGER on_team_notifications_updated
    BEFORE UPDATE ON public.team_notifications
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Função e Trigger na tabela production_tracking para notificação
CREATE OR REPLACE FUNCTION public.trg_notify_production_stage_change()
RETURNS TRIGGER AS $$
DECLARE
    payload jsonb;
BEGIN
    -- Disparar apenas se for um INSERT ou se a etapa de fato mudou
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage) THEN
        payload := jsonb_build_object(
            'order_id', NEW.order_id,
            'stage', NEW.stage,
            'old_stage', CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage ELSE NULL END
        );
        
        -- Chamar a Edge Function de forma assíncrona
        PERFORM net.http_post(
            url := 'https://xjryvzmejpzwzuroquur.supabase.co/functions/v1/send-team-notification',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_"}'::jsonb,
            body := payload
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar a trigger na tabela production_tracking
DROP TRIGGER IF EXISTS on_production_stage_change ON public.production_tracking;
CREATE TRIGGER on_production_stage_change
    AFTER INSERT OR UPDATE ON public.production_tracking
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_notify_production_stage_change();
