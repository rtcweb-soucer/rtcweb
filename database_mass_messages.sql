-- Migration para o módulo de Ativação de Clientes (Disparo em Lote)

CREATE TABLE IF NOT EXISTS mass_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    phone TEXT NOT NULL,
    message_template TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, ERROR
    sent_at TIMESTAMPTZ,
    error_log TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE mass_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Permitir leitura para usuários autenticados
CREATE POLICY "Enable read for authenticated users mass_messages" ON mass_messages
    FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir inserção para usuários autenticados
CREATE POLICY "Enable insert for authenticated users mass_messages" ON mass_messages
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Permitir atualização para usuários autenticados
CREATE POLICY "Enable update for authenticated users mass_messages" ON mass_messages
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Permitir deleção para usuários autenticados
CREATE POLICY "Enable delete for authenticated users mass_messages" ON mass_messages
    FOR DELETE USING (auth.role() = 'authenticated');
