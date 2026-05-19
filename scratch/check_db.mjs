import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://xjryvzmejpzwzuroquur.supabase.co";
const SUPABASE_KEY = "sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data: o } = await supabase.from('orders').select('*').limit(1);
    console.log("ORDER:", o[0]);

    const { data: c } = await supabase.from('customers').select('*').limit(1);
    console.log("CUSTOMER:", c[0]);
}

run();
