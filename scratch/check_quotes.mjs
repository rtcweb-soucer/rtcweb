import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://xjryvzmejpzwzuroquur.supabase.co";
const SUPABASE_KEY = "sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data: quotes } = await supabase
        .from('orders')
        .select('id, quote_number, status')
        .eq('status', 'QUOTE_SENT')
        .order('created_at', { ascending: false });

    console.log("Total QUOTE_SENT:", quotes.length);
    console.log("With quote_number:", quotes.filter(q => q.quote_number).length);
    console.log("Without quote_number:", quotes.filter(q => !q.quote_number).length);
}
run();
