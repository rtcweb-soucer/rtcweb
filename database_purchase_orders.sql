-- 1. Tabela de Ordens de Compra (OC)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_name text NOT NULL,
  total_amount numeric(10, 2) NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'RECEIVED', 'CANCELED')),
  expected_delivery_date date,
  received_date timestamptz,
  linked_request_ids text[], -- IDs das solicitações vinculadas nesta OC
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tabela de Solicitações de Material (Se ainda não existir conforme especificado no types.ts)
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id text REFERENCES public.orders(id) ON DELETE SET NULL,
  requester_name text,
  items_requested jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'ORDERED', 'RECEIVED', 'CANCELED')),
  notes text,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Adicionar referência na tabela de transações financeiras para rastreabilidade
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='financial_transactions' AND COLUMN_NAME='purchase_order_id') THEN
    ALTER TABLE public.financial_transactions ADD COLUMN purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Habilitando RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

-- 5. Políticas
CREATE POLICY "Enable read/write for all authenticated users" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all authenticated users" ON public.purchase_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
