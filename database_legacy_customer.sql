-- Adiciona a coluna para armazenar o ID inteiro do sistema antigo
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS legacy_id integer;

-- Adiciona a coluna para armazenar o histórico narrativo de compras antigas
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS legacy_history text;

-- Cria um índice no legacy_id para facilitar a busca, caso o cliente pesquise pelo código antigo
CREATE INDEX IF NOT EXISTS idx_customers_legacy_id ON public.customers(legacy_id);
