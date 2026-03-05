-- 1. Solicitações de Compra (originadas do PCP)
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id text REFERENCES public.orders(id) ON DELETE SET NULL, -- Qual pedido gerou a necessidade
  requester_name text, -- Quem na fábrica pediu
  items_requested jsonb NOT NULL, -- Lista de itens [{"name": "Lona", "quantity": 10, "unit": "m"}]
  status text NOT NULL CHECK (status IN ('PENDING', 'ORDERED', 'RECEIVED', 'CANCELED')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Ordens de Compra (feitas pelo comprador)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_name text NOT NULL,
  total_amount numeric(10, 2) NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'RECEIVED', 'CANCELED')),
  expected_delivery_date date,
  received_date date,
  linked_request_ids uuid[], -- Array de ids de purchase_requests que essa ordem atende
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON public.purchase_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Views Agregadoras para o Dashboard Financeiro (Extremamente Rápidas e Leves)
-- Essa View pega todas as entradas/saídas PENDENTES para a projeção
CREATE OR REPLACE VIEW public.vw_cashflow_expected AS
SELECT 
  to_char(due_date, 'YYYY-MM') as month_year,
  type,
  SUM(amount) as total_amount
FROM public.financial_transactions
WHERE status = 'PENDING'
GROUP BY to_char(due_date, 'YYYY-MM'), type;

-- Essa View pega todas as entradas/saídas PAGAS para o DRE / Realizado
CREATE OR REPLACE VIEW public.vw_cashflow_realized AS
SELECT 
  to_char(paid_date, 'YYYY-MM') as month_year,
  type,
  SUM(amount) as total_amount
FROM public.financial_transactions
WHERE status = 'PAID' AND paid_date IS NOT NULL
GROUP BY to_char(paid_date, 'YYYY-MM'), type;

-- Essa View agrupa gastos por categoria para o DRE
CREATE OR REPLACE VIEW public.vw_expenses_by_category AS
SELECT 
  to_char(t.paid_date, 'YYYY-MM') as month_year,
  c.name as category_name,
  SUM(t.amount) as total_amount
FROM public.financial_transactions t
JOIN public.account_categories c ON t.category_id = c.id
WHERE t.status = 'PAID' AND t.type = 'EXPENSE'
GROUP BY to_char(t.paid_date, 'YYYY-MM'), c.name;


-- 4. Função e Triggers (Automações)
-- Vamos criar de forma segura: Essa trigger gera a conta a pagar para uma Ordem de Compra quando ela é recebida.
CREATE OR REPLACE FUNCTION public.handle_purchase_order_received()
RETURNS TRIGGER AS $$
DECLARE
  custo_variavel_id uuid;
BEGIN
  -- Se o status mudou para RECEIVED
  IF NEW.status = 'RECEIVED' AND OLD.status != 'RECEIVED' THEN
    -- Pega o ID da categoria de Custo Variável
    SELECT id INTO custo_variavel_id FROM public.account_categories WHERE code = '2.0.0' LIMIT 1;
    
    -- Insere no financeiro
    INSERT INTO public.financial_transactions 
      (description, amount, type, status, due_date, category_id, purchase_order_id)
    VALUES 
      ('Compra de Material - ' || NEW.supplier_name, NEW.total_amount, 'EXPENSE', 'PENDING', CURRENT_DATE + interval '7 days', custo_variavel_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_purchase_order_received ON public.purchase_orders;
CREATE TRIGGER tr_purchase_order_received
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_order_received();
