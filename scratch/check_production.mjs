import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://xjryvzmejpzwzuroquur.supabase.co";
const SUPABASE_KEY = "sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, contract_number, customer_id, status, production_stage, delivery_deadline, created_at')
        .in('status', ['CONTRACT_SIGNED', 'IN_PRODUCTION']);
        
    if (error) console.error(error);
    
    let delayed = 0;
    let inTime = 0;
    const now = new Date();
    
    const stageCounts = {};
    
    for (const o of orders || []) {
        if (!stageCounts[o.production_stage || 'Não Iniciado']) {
            stageCounts[o.production_stage || 'Não Iniciado'] = 0;
        }
        stageCounts[o.production_stage || 'Não Iniciado']++;
        
        if (o.delivery_deadline && new Date(o.delivery_deadline) < now) {
            delayed++;
        } else {
            inTime++;
        }
    }
    
    console.log(`Total em Produção: ${orders?.length}`);
    console.log(`Atrasados: ${delayed}`);
    console.log(`No Prazo: ${inTime}`);
    console.log(`Por Etapa:`, stageCounts);
}
run();
