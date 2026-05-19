-- Script para agendar a Edge Function "weekly-quotes-report" no Supabase usando pg_cron
-- ATENÇÃO: Execute este script na aba "SQL Editor" do painel do Supabase.

-- 1. Habilitar as extensões necessárias (se ainda não estiverem)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Limpar qualquer agendamento anterior (para não duplicar)
SELECT cron.unschedule('weekly-quotes-report-job');

-- 3. Criar o agendamento
-- '0 8 * * 1' significa: Toda Segunda-feira (1) às 08:00 da manhã
SELECT cron.schedule(
    'weekly-quotes-report-job',
    '0 8 * * 1',
    $$
    SELECT net.http_post(
        url := 'https://xjryvzmejpzwzuroquur.supabase.co/functions/v1/weekly-quotes-report',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_"}'::jsonb
    );
    $$
);

-- Para verificar se o agendamento foi criado com sucesso:
-- SELECT * FROM cron.job;
