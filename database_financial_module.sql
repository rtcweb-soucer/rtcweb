-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Plano de Contas
CREATE TABLE IF NOT EXISTS public.account_categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  parent_id uuid REFERENCES public.account_categories(id),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Transações Financeiras (Contas a Pagar / Receber)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  description text NOT NULL,
  amount numeric(10, 2) NOT NULL,
  type text NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  status text NOT NULL CHECK (status IN ('PENDING', 'PAID', 'CANCELED')),
  due_date date NOT NULL,
  paid_date date,
  category_id uuid REFERENCES public.account_categories(id),
  order_id text REFERENCES public.orders(id) ON DELETE SET NULL,
  installment_id text,
  installer_id uuid REFERENCES public.installers(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  notes text,
  payment_method text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Habilitando Segurança em Nível de Linha (RLS)
ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acesso
CREATE POLICY "Enable read/write for all authenticated users" ON public.account_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all authenticated users" ON public.financial_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Inserir Categorias Básicas do Plano de Contas
INSERT INTO public.account_categories (code, name, type) VALUES
('1.0.0', 'Receitas Operacionais', 'INCOME'),
('2.0.0', 'Custos Variáveis', 'EXPENSE'),
('3.0.0', 'Despesas de Vendas (Comissões)', 'EXPENSE'),
('4.0.0', 'Custos de Instalação (Diárias)', 'EXPENSE'),
('5.0.0', 'Despesas Administrativas', 'EXPENSE')
ON CONFLICT (code) DO NOTHING;
