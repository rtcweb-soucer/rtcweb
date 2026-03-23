-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED')),
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    assigned_to UUID REFERENCES public.system_users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.system_users(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Register RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Simple policies (allow all for authenticated users for now, matching existing patterns)
CREATE POLICY "Allow all for authenticated users on tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- Functions and triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER on_task_updated
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();
