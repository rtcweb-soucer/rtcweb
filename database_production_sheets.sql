-- 1. Fichas Técnicas (Cabecalho)
CREATE TABLE IF NOT EXISTS public.technical_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text REFERENCES public.customers(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES public.employees(id) ON DELETE SET NULL, -- Vinculado ao funcionário/vendedor
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Itens de Medição
CREATE TABLE IF NOT EXISTS public.measurement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technical_sheet_id uuid REFERENCES public.technical_sheets(id) ON DELETE CASCADE,
  product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  parent_item_id uuid REFERENCES public.measurement_items(id) ON DELETE SET NULL,
  width numeric(10, 3) NOT NULL DEFAULT 0,
  height numeric(10, 3) NOT NULL DEFAULT 0,
  environment text NOT NULL,
  product_type text,
  color text,
  command text,
  notes text,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Fichas de Produção e Instalação (Main)
CREATE TABLE IF NOT EXISTS public.production_installation_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_item_id uuid REFERENCES public.measurement_items(id) ON DELETE CASCADE UNIQUE,
  video_link text,
  observacoes_gerais text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Detalhes específicos de CORTINA
CREATE TABLE IF NOT EXISTS public.production_sheet_cortina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_sheet_id uuid REFERENCES public.production_installation_sheets(id) ON DELETE CASCADE UNIQUE,
  comando text,
  vao text,
  varao_cor text,
  instalacao text,
  trilho text,
  posicionamento text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Detalhes específicos de TOLDO
CREATE TABLE IF NOT EXISTS public.production_sheet_toldo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_sheet_id uuid REFERENCES public.production_installation_sheets(id) ON DELETE CASCADE UNIQUE,
  modelo text,
  comando text,
  bambinela text,
  vies text,
  entre_vao text,
  cor_ferragem text,
  bracos text,
  medidas_braco text,
  fixacao text,
  medida_fixacao text,
  trava text,
  manivela_qtd integer,
  medida_manivela text,
  parapeito text,
  largura_beiral text,
  caida text,
  altura_instalacao text,
  instalacao text,
  corredica boolean DEFAULT false,
  posicionamento text,
  obs text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Detalhes específicos de COBERTURA
CREATE TABLE IF NOT EXISTS public.production_sheet_cobertura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_sheet_id uuid REFERENCES public.production_installation_sheets(id) ON DELETE CASCADE UNIQUE,
  cor_ferragem text,
  altura_instalacao text,
  caida text,
  calha_saida text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.technical_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_installation_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_sheet_cortina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_sheet_toldo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_sheet_cobertura ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Permitir tudo para usuários autenticados)
CREATE POLICY "Allow all for authenticated users" ON public.technical_sheets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.measurement_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.production_installation_sheets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.production_sheet_cortina FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.production_sheet_toldo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.production_sheet_cobertura FOR ALL TO authenticated USING (true) WITH CHECK (true);
