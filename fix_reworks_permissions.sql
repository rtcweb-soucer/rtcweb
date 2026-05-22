-- 1. Garante os direitos de acesso para a API do Supabase (anon e authenticated)
GRANT ALL ON TABLE public.reworks TO anon;
GRANT ALL ON TABLE public.reworks TO authenticated;
GRANT ALL ON TABLE public.reworks TO service_role;

-- 2. Desabilita a política de segurança a nível de linha (RLS) para permitir que qualquer usuário do sistema consiga inserir os registros
ALTER TABLE public.reworks DISABLE ROW LEVEL SECURITY;
