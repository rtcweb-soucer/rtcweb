-- Tabela principal de Detalhamentos de Produção
CREATE TABLE production_detailings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de regras de detalhamento
CREATE TABLE production_detailing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    detailing_id UUID REFERENCES production_detailings(id) ON DELETE CASCADE,
    min_width NUMERIC,
    max_width NUMERIC,
    min_height NUMERIC,
    max_height NUMERIC,
    components TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE production_detailings ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_detailing_rules ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Enable all access for authenticated users" ON production_detailings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON production_detailing_rules FOR ALL USING (auth.role() = 'authenticated');

-- Atualizar o schema de products para vincular o detalhamento
ALTER TABLE products ADD COLUMN IF NOT EXISTS production_detailing_id UUID REFERENCES production_detailings(id) ON DELETE SET NULL;
