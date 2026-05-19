import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://xjryvzmejpzwzuroquur.supabase.co";
const SUPABASE_KEY = "sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, production_stage, delivery_deadline')
        .in('status', ['CONTRACT_SIGNED', 'IN_PRODUCTION']);
        
    const { data: tracking, error: tErr } = await supabase
        .from('production_tracking')
        .select('*');

    console.log(`Total orders: ${orders ? orders.length : 0}`);
    console.log(`Total tracking rows: ${tracking ? tracking.length : 0}`);
    
    if (orders && orders.length > 0) {
        const stages = {};
        for(let o of orders) {
            const track = tracking?.find(t => t.order_id === o.id);
            const stage = track?.stage || o.production_stage || 'Aguardando PCP';
            if(!stages[stage]) stages[stage] = 0;
            stages[stage]++;
        }
        console.log("Real Stages for these orders:", stages);
    }
}
run();
